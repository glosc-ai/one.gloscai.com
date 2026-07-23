package volcengine

import (
	"bytes"
	"compress/gzip"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

const (
	seedASRSampleRate      = 16000
	seedASRBytesPerSample  = 2
	seedASRChannels        = 1
	seedASRMaxMessageBytes = 16 << 20
)

func handleAgentPlanSeedASRResponse(c *gin.Context, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	if info == nil || info.ClientWs == nil || info.TargetWs == nil {
		return nil, types.NewErrorWithStatusCode(
			errors.New("invalid SeedASR websocket connection"),
			types.ErrorCodeBadResponse,
			http.StatusInternalServerError,
		)
	}

	info.IsStream = true
	info.AudioUsage = true
	info.ClientWs.SetReadLimit(seedASRMaxMessageBytes)
	info.TargetWs.SetReadLimit(seedASRMaxMessageBytes)

	var audioBytes atomic.Int64
	done := make(chan struct{}, 2)
	errCh := make(chan error, 2)

	gopool.Go(func() {
		proxySeedASRMessages(info, info.ClientWs, info.TargetWs, &audioBytes, done, errCh, false)
	})
	gopool.Go(func() {
		proxySeedASRMessages(info, info.TargetWs, info.ClientWs, nil, done, errCh, true)
	})

	var proxyErr error
	select {
	case <-done:
	case proxyErr = <-errCh:
	case <-c.Done():
		proxyErr = c.Request.Context().Err()
	}

	if proxyErr != nil {
		return nil, types.NewErrorWithStatusCode(
			proxyErr,
			types.ErrorCodeBadResponse,
			http.StatusBadGateway,
		)
	}

	durationSeconds := float64(audioBytes.Load()) / float64(seedASRSampleRate*seedASRBytesPerSample*seedASRChannels)
	audioTokens := common.QuotaRound(math.Ceil(durationSeconds) / 60.0 * 1000)
	usage := &dto.RealtimeUsage{
		TotalTokens: audioTokens,
		InputTokens: audioTokens,
	}
	usage.InputTokenDetails.AudioTokens = audioTokens

	if info.PriceData.UsePrice && info.PriceData.ModelPrice > 0 &&
		model.GetModelBillingType(info.OriginModelName) == model.BillingTypePerSecond {
		info.PriceData.ModelPrice *= durationSeconds
	}

	return usage, nil
}

func proxySeedASRMessages(
	info *relaycommon.RelayInfo,
	source *websocket.Conn,
	target *websocket.Conn,
	audioBytes *atomic.Int64,
	done chan<- struct{},
	errCh chan<- error,
	markFirstResponse bool,
) {
	for {
		messageType, payload, err := source.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				done <- struct{}{}
				return
			}
			errCh <- fmt.Errorf("SeedASR websocket read failed: %w", err)
			return
		}

		if audioBytes != nil {
			if messageType != websocket.BinaryMessage {
				errCh <- fmt.Errorf("SeedASR client message must be binary, got websocket type %d", messageType)
				return
			}
			size, parseErr := seedASRAudioPayloadBytes(payload)
			if parseErr != nil {
				errCh <- fmt.Errorf("invalid SeedASR client frame: %w", parseErr)
				return
			}
			if size > 0 {
				audioBytes.Add(size)
			}
		}

		if markFirstResponse {
			info.SetFirstResponseTime()
		}
		if err := target.WriteMessage(messageType, payload); err != nil {
			errCh <- fmt.Errorf("SeedASR websocket write failed: %w", err)
			return
		}
	}
}

func seedASRAudioPayloadBytes(frame []byte) (int64, error) {
	message, err := NewMessageFromBytes(frame)
	if err != nil {
		return 0, err
	}
	if message.MsgType != MsgTypeAudioOnlyClient {
		return 0, nil
	}

	payload := message.Payload
	switch message.Compression {
	case CompressionNone:
		if len(payload) > seedASRMaxMessageBytes {
			return 0, errors.New("SeedASR audio payload is too large")
		}
	case CompressionGZIP:
		reader, err := gzip.NewReader(bytes.NewReader(payload))
		if err != nil {
			return 0, fmt.Errorf("open gzip payload: %w", err)
		}
		decompressed, readErr := io.ReadAll(io.LimitReader(reader, seedASRMaxMessageBytes+1))
		closeErr := reader.Close()
		if readErr != nil {
			return 0, fmt.Errorf("decompress gzip payload: %w", readErr)
		}
		if closeErr != nil {
			return 0, fmt.Errorf("close gzip payload: %w", closeErr)
		}
		if len(decompressed) > seedASRMaxMessageBytes {
			return 0, errors.New("SeedASR decompressed audio payload is too large")
		}
		payload = decompressed
	default:
		return 0, fmt.Errorf("unsupported SeedASR compression: %d", message.Compression)
	}

	if !bytes.HasPrefix(payload, []byte("RIFF")) {
		return int64(len(payload)), nil
	}
	dataOffset, err := wavDataOffset(payload)
	if err != nil {
		return 0, err
	}
	return int64(len(payload) - dataOffset), nil
}

func wavDataOffset(payload []byte) (int, error) {
	if len(payload) < 12 || !bytes.Equal(payload[8:12], []byte("WAVE")) {
		return 0, errors.New("invalid WAV header")
	}
	for offset := 12; offset+8 <= len(payload); {
		chunkSize := int(binary.LittleEndian.Uint32(payload[offset+4 : offset+8]))
		if bytes.Equal(payload[offset:offset+4], []byte("data")) {
			return offset + 8, nil
		}
		next := offset + 8 + chunkSize
		if chunkSize%2 != 0 {
			next++
		}
		if next <= offset || next > len(payload) {
			return 0, errors.New("invalid WAV chunk size")
		}
		offset = next
	}
	return 0, errors.New("WAV data chunk not found")
}
