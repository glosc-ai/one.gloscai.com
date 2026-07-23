package volcengine

import (
	"bytes"
	"compress/gzip"
	"encoding/binary"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAgentPlanSeedASRRelaysBinaryFramesAndReturnsAudioUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	externalClient, gatewayClient := testWebSocketPair(t)
	gatewayTarget, upstreamServer := testWebSocketPair(t)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, relayconstant.VolcEngineAgentPlanSeedASRPath, nil)
	info := &relaycommon.RelayInfo{
		ClientWs:        gatewayClient,
		TargetWs:        gatewayTarget,
		OriginModelName: relayconstant.VolcEngineAgentPlanSeedASRModel,
	}

	type handlerResult struct {
		usage any
		err   *types.NewAPIError
	}
	resultCh := make(chan handlerResult, 1)
	go func() {
		usage, apiErr := handleAgentPlanSeedASRResponse(c, info)
		resultCh <- handlerResult{usage: usage, err: apiErr}
	}()

	fullRequest := testSeedASRFrame(t, MsgTypeFullClientRequest, MsgTypeFlagPositiveSeq, CompressionGZIP, []byte(`{"request":{"model_name":"bigmodel"}}`))
	require.NoError(t, externalClient.WriteMessage(websocket.BinaryMessage, fullRequest))
	messageType, relayedFullRequest, err := upstreamServer.ReadMessage()
	require.NoError(t, err)
	assert.Equal(t, websocket.BinaryMessage, messageType)
	assert.Equal(t, fullRequest, relayedFullRequest)

	pcm := bytes.Repeat([]byte{0x12, 0x34}, 3200)
	audioRequest := testSeedASRFrame(t, MsgTypeAudioOnlyClient, MsgTypeFlagNegativeSeq, CompressionGZIP, testSeedASRWAV(pcm))
	require.NoError(t, externalClient.WriteMessage(websocket.BinaryMessage, audioRequest))
	messageType, relayedAudioRequest, err := upstreamServer.ReadMessage()
	require.NoError(t, err)
	assert.Equal(t, websocket.BinaryMessage, messageType)
	assert.Equal(t, audioRequest, relayedAudioRequest)

	serverResponse := testSeedASRFrame(t, MsgTypeFullServerResponse, MsgTypeFlagNegativeSeq, CompressionGZIP, []byte(`{"result":{"text":"测试成功"}}`))
	require.NoError(t, upstreamServer.WriteMessage(websocket.BinaryMessage, serverResponse))
	messageType, relayedServerResponse, err := externalClient.ReadMessage()
	require.NoError(t, err)
	assert.Equal(t, websocket.BinaryMessage, messageType)
	assert.Equal(t, serverResponse, relayedServerResponse)

	require.NoError(t, externalClient.WriteControl(
		websocket.CloseMessage,
		websocket.FormatCloseMessage(websocket.CloseNormalClosure, "done"),
		time.Now().Add(time.Second),
	))

	select {
	case result := <-resultCh:
		require.Nil(t, result.err)
		usage, ok := result.usage.(*dto.RealtimeUsage)
		require.True(t, ok)
		assert.Equal(t, 17, usage.TotalTokens)
		assert.Equal(t, 17, usage.InputTokens)
		assert.Equal(t, 17, usage.InputTokenDetails.AudioTokens)
	case <-time.After(3 * time.Second):
		require.Fail(t, "SeedASR relay did not stop after the client closed")
	}
}

func TestSeedASRAudioPayloadBytes(t *testing.T) {
	pcm := bytes.Repeat([]byte{0x12, 0x34}, 3200)
	wav := testSeedASRWAV(pcm)

	tests := []struct {
		name    string
		frame   []byte
		want    int64
		wantErr string
	}{
		{
			name:  "full client request is not audio",
			frame: testSeedASRFrame(t, MsgTypeFullClientRequest, MsgTypeFlagPositiveSeq, CompressionGZIP, []byte(`{"request":{"model_name":"bigmodel"}}`)),
		},
		{
			name:  "gzip WAV excludes container header",
			frame: testSeedASRFrame(t, MsgTypeAudioOnlyClient, MsgTypeFlagPositiveSeq, CompressionGZIP, wav),
			want:  int64(len(pcm)),
		},
		{
			name:  "following raw PCM chunk counts all bytes",
			frame: testSeedASRFrame(t, MsgTypeAudioOnlyClient, MsgTypeFlagNegativeSeq, CompressionNone, pcm),
			want:  int64(len(pcm)),
		},
		{
			name:    "unsupported compression is rejected",
			frame:   testSeedASRFrame(t, MsgTypeAudioOnlyClient, MsgTypeFlagPositiveSeq, CompressionBits(2), pcm),
			wantErr: "unsupported SeedASR compression: 2",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := seedASRAudioPayloadBytes(test.frame)
			if test.wantErr != "" {
				require.EqualError(t, err, test.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, test.want, got)
		})
	}
}

func TestMessageUnmarshalSeparatesSerializationAndCompression(t *testing.T) {
	frame := testSeedASRFrame(t, MsgTypeAudioOnlyClient, MsgTypeFlagPositiveSeq, CompressionGZIP, []byte("audio"))

	message, err := NewMessageFromBytes(frame)

	require.NoError(t, err)
	assert.Equal(t, SerializationJSON, message.Serialization)
	assert.Equal(t, CompressionGZIP, message.Compression)
}

func testSeedASRFrame(t *testing.T, messageType MsgType, flag MsgTypeFlagBits, compression CompressionBits, payload []byte) []byte {
	t.Helper()
	if compression == CompressionGZIP {
		var compressed bytes.Buffer
		writer := gzip.NewWriter(&compressed)
		_, err := writer.Write(payload)
		require.NoError(t, err)
		require.NoError(t, writer.Close())
		payload = compressed.Bytes()
	}

	message, err := NewMessage(messageType, flag)
	require.NoError(t, err)
	message.Sequence = 1
	if flag == MsgTypeFlagNegativeSeq {
		message.Sequence = -1
	}
	message.Compression = compression
	message.Payload = payload
	frame, err := message.Marshal()
	require.NoError(t, err)
	return frame
}

func testSeedASRWAV(pcm []byte) []byte {
	wav := make([]byte, 44+len(pcm))
	copy(wav[0:4], "RIFF")
	binary.LittleEndian.PutUint32(wav[4:8], uint32(len(wav)-8))
	copy(wav[8:12], "WAVE")
	copy(wav[12:16], "fmt ")
	binary.LittleEndian.PutUint32(wav[16:20], 16)
	binary.LittleEndian.PutUint16(wav[20:22], 1)
	binary.LittleEndian.PutUint16(wav[22:24], seedASRChannels)
	binary.LittleEndian.PutUint32(wav[24:28], seedASRSampleRate)
	binary.LittleEndian.PutUint32(wav[28:32], seedASRSampleRate*seedASRBytesPerSample*seedASRChannels)
	binary.LittleEndian.PutUint16(wav[32:34], seedASRBytesPerSample*seedASRChannels)
	binary.LittleEndian.PutUint16(wav[34:36], seedASRBytesPerSample*8)
	copy(wav[36:40], "data")
	binary.LittleEndian.PutUint32(wav[40:44], uint32(len(pcm)))
	copy(wav[44:], pcm)
	return wav
}

func testWebSocketPair(t *testing.T) (*websocket.Conn, *websocket.Conn) {
	t.Helper()
	serverConnCh := make(chan *websocket.Conn, 1)
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		serverConnCh <- conn
	}))
	t.Cleanup(server.Close)

	clientConn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	require.NoError(t, err)
	serverConn := <-serverConnCh
	t.Cleanup(func() {
		clientConn.Close()
		serverConn.Close()
	})
	return clientConn, serverConn
}
