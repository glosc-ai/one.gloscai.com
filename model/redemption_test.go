package model

import (
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRedemptionTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	oldDB := DB
	oldLogDB := LOG_DB
	oldMainDatabaseType := common.MainDatabaseType()
	oldLogDatabaseType := common.LogDatabaseType()
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)

	dsn := fmt.Sprintf(
		"file:%s?mode=memory&cache=shared",
		strings.ReplaceAll(t.Name(), "/", "_"),
	)
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)

	DB = db
	LOG_DB = db
	require.NoError(t, db.AutoMigrate(&Redemption{}))

	t.Cleanup(func() {
		DB = oldDB
		LOG_DB = oldLogDB
		common.SetDatabaseTypes(oldMainDatabaseType, oldLogDatabaseType)
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func seedRedemption(t *testing.T, db *gorm.DB, redemption Redemption) Redemption {
	t.Helper()

	require.NoError(t, db.Create(&redemption).Error)
	return redemption
}

func TestGetAllRedemptionsFiltersDisplayedStatus(t *testing.T) {
	db := setupRedemptionTestDB(t)
	now := common.GetTimestamp()

	active := seedRedemption(t, db, Redemption{
		Key:         "active",
		Name:        "active",
		Status:      common.RedemptionCodeStatusEnabled,
		CreatedTime: now,
		ExpiredTime: 0,
	})
	seedRedemption(t, db, Redemption{
		Key:         "expired",
		Name:        "expired",
		Status:      common.RedemptionCodeStatusEnabled,
		CreatedTime: now,
		ExpiredTime: now - 60,
	})
	disabled := seedRedemption(t, db, Redemption{
		Key:         "disabled",
		Name:        "disabled",
		Status:      common.RedemptionCodeStatusDisabled,
		CreatedTime: now,
		ExpiredTime: now - 60,
	})

	redemptions, total, err := GetAllRedemptions(0, 10, "1", "id", "asc")
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, redemptions, 1)
	assert.Equal(t, active.Id, redemptions[0].Id)

	redemptions, total, err = GetAllRedemptions(0, 10, "2", "id", "asc")
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, redemptions, 1)
	assert.Equal(t, disabled.Id, redemptions[0].Id)
}

func TestGetAllRedemptionsFiltersExpiredStatus(t *testing.T) {
	db := setupRedemptionTestDB(t)
	now := common.GetTimestamp()

	expired := seedRedemption(t, db, Redemption{
		Key:         "expired-enabled",
		Name:        "expired-enabled",
		Status:      common.RedemptionCodeStatusEnabled,
		CreatedTime: now,
		ExpiredTime: now - 60,
	})
	seedRedemption(t, db, Redemption{
		Key:         "expired-disabled",
		Name:        "expired-disabled",
		Status:      common.RedemptionCodeStatusDisabled,
		CreatedTime: now,
		ExpiredTime: now - 60,
	})
	seedRedemption(t, db, Redemption{
		Key:         "active",
		Name:        "active",
		Status:      common.RedemptionCodeStatusEnabled,
		CreatedTime: now,
		ExpiredTime: now + 60,
	})

	redemptions, total, err := GetAllRedemptions(
		0,
		10,
		redemptionStatusExpiredFilter,
		"id",
		"asc",
	)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, redemptions, 1)
	assert.Equal(t, expired.Id, redemptions[0].Id)
}

func TestSearchRedemptionsCombinesKeywordAndStatus(t *testing.T) {
	db := setupRedemptionTestDB(t)
	now := common.GetTimestamp()

	disabled := seedRedemption(t, db, Redemption{
		Key:         "match-disabled",
		Name:        "Match disabled",
		Status:      common.RedemptionCodeStatusDisabled,
		CreatedTime: now,
	})
	seedRedemption(t, db, Redemption{
		Key:         "match-used",
		Name:        "Match used",
		Status:      common.RedemptionCodeStatusUsed,
		CreatedTime: now,
	})
	seedRedemption(t, db, Redemption{
		Key:         "other-disabled",
		Name:        "Other disabled",
		Status:      common.RedemptionCodeStatusDisabled,
		CreatedTime: now,
	})

	redemptions, total, err := SearchRedemptions(
		"Match",
		0,
		10,
		"2",
		"id",
		"asc",
	)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, redemptions, 1)
	assert.Equal(t, disabled.Id, redemptions[0].Id)
}
