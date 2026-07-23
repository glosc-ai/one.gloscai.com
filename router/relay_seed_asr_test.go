package router

import (
	"net/http"
	"testing"

	relayconstant "github.com/QuantumNous/new-api/relay/constant"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRelayRouterRegistersAgentPlanSeedASRWebSocket(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	SetRelayRouter(router)

	for _, route := range router.Routes() {
		if route.Method == http.MethodGet && route.Path == relayconstant.VolcEngineAgentPlanSeedASRPath {
			return
		}
	}
	require.Fail(t, "SeedASR WebSocket route is not registered")
}
