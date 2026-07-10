package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMatchModelVendorNamespace(t *testing.T) {
	vendors := []Vendor{
		{Id: 1, Name: "OpenAI"},
		{Id: 2, Name: "Anthropic"},
		{Id: 3, Name: "Moonshot", Alias: "月之暗面"},
		{Id: 4, Name: "Custom", Alias: "My Provider"},
	}
	nameIndex, aliasIndex := buildVendorMatchIndexes(vendors)

	tests := []struct {
		name        string
		modelName   string
		vendorID    int
		isAmbiguous bool
	}{
		{name: "name", modelName: "openai/gpt-5-pro", vendorID: 1},
		{name: "case insensitive", modelName: " ANTHROPIC/claude-3.5-haiku ", vendorID: 2},
		{name: "known namespace alias", modelName: "moonshotai/kimi-k2", vendorID: 3},
		{name: "vendor alias", modelName: "my-provider/model", vendorID: 4},
		{name: "unknown outer namespace", modelName: "openrouter/anthropic/claude-3.5-haiku"},
		{name: "model without namespace", modelName: "gpt-5-pro"},
		{name: "empty namespace", modelName: "/gpt-5-pro"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			vendorID, ambiguous := matchModelVendor(tt.modelName, nameIndex, aliasIndex)
			assert.Equal(t, tt.vendorID, vendorID)
			assert.Equal(t, tt.isAmbiguous, ambiguous)
		})
	}
}

func TestMatchModelVendorRejectsAmbiguousNormalizedNames(t *testing.T) {
	vendors := []Vendor{
		{Id: 1, Name: "OpenAI"},
		{Id: 2, Name: "Open-AI"},
	}
	nameIndex, aliasIndex := buildVendorMatchIndexes(vendors)

	vendorID, ambiguous := matchModelVendor("open_ai/gpt-5-pro", nameIndex, aliasIndex)
	require.True(t, ambiguous)
	assert.Equal(t, ambiguousVendorMatch, vendorID)
}

func TestMatchModelVendorPrefersNameOverAlias(t *testing.T) {
	vendors := []Vendor{
		{Id: 1, Name: "OpenAI"},
		{Id: 2, Name: "Another Vendor", Alias: "open-ai"},
	}
	nameIndex, aliasIndex := buildVendorMatchIndexes(vendors)

	vendorID, ambiguous := matchModelVendor("openai/gpt-5-pro", nameIndex, aliasIndex)
	require.False(t, ambiguous)
	assert.Equal(t, 1, vendorID)
}
