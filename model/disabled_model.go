package model

import (
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func excludeActiveDisabledModels(query *gorm.DB) *gorm.DB {
	if DB == nil || !DB.Migrator().HasTable(&DisabledModel{}) {
		return query
	}
	return query.Where("NOT EXISTS (SELECT 1 FROM disabled_models WHERE disabled_models.channel_id = abilities.channel_id AND disabled_models.model_name = abilities.model AND disabled_models.expires_at > ?)", time.Now().Unix())
}

type DisabledModel struct {
	Id          int    `json:"id"`
	ModelName   string `json:"model_name" gorm:"size:255;not null;index:idx_disabled_model_channel,unique"`
	ChannelId   int    `json:"channel_id" gorm:"not null;index;index:idx_disabled_model_channel,unique"`
	ChannelName string `json:"channel_name" gorm:"size:255"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint;index"`
	ExpiresAt   int64  `json:"expires_at" gorm:"bigint;index"`
	Remark      string `json:"remark" gorm:"type:varchar(255)"`
}

func AddDisabledModel(modelName string, channelId int, channelName string, duration time.Duration, remark string) error {
	now := time.Now().Unix()
	record := DisabledModel{
		ModelName:   strings.TrimSpace(modelName),
		ChannelId:   channelId,
		ChannelName: channelName,
		CreatedAt:   now,
		ExpiresAt:   now + int64(duration.Seconds()),
		Remark:      strings.TrimSpace(remark),
	}
	return DB.Where("model_name = ? AND channel_id = ?", record.ModelName, channelId).
		Assign(record).
		FirstOrCreate(&record).Error
}

func DeleteDisabledModel(id int) error {
	return DB.Delete(&DisabledModel{}, id).Error
}

func DeleteDisabledModelByChannelModel(channelId int, modelName string) error {
	return DB.Where("channel_id = ? AND model_name = ?", channelId, strings.TrimSpace(modelName)).Delete(&DisabledModel{}).Error
}

func CleanExpiredDisabledModels() error {
	return DB.Where("expires_at <= ?", time.Now().Unix()).Delete(&DisabledModel{}).Error
}

func IsDisabledModel(channelId int, modelName string) bool {
	var count int64
	err := DB.Model(&DisabledModel{}).
		Where("channel_id = ? AND model_name = ? AND expires_at > ?", channelId, strings.TrimSpace(modelName), time.Now().Unix()).
		Count(&count).Error
	return err == nil && count > 0
}

type DisabledModelFilter struct {
	ModelName string
	Channel   string
	Remark    string
	Active    *bool
}

func ListDisabledModels(startIdx int, num int, filter DisabledModelFilter) ([]DisabledModel, int64, error) {
	now := time.Now().Unix()
	query := DB.Model(&DisabledModel{})
	if filter.ModelName != "" {
		query = query.Where("model_name LIKE ?", "%"+strings.TrimSpace(filter.ModelName)+"%")
	}
	if filter.Channel != "" {
		channel := strings.TrimSpace(filter.Channel)
		if channelId, err := strconv.Atoi(channel); err == nil {
			query = query.Where("(channel_name LIKE ? OR channel_id = ?)", "%"+channel+"%", channelId)
		} else {
			query = query.Where("channel_name LIKE ?", "%"+channel+"%")
		}
	}
	if filter.Remark != "" {
		query = query.Where("remark LIKE ?", "%"+strings.TrimSpace(filter.Remark)+"%")
	}
	if filter.Active != nil {
		if *filter.Active {
			query = query.Where("expires_at > ?", now)
		} else {
			query = query.Where("expires_at <= ?", now)
		}
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	records := make([]DisabledModel, 0)
	err := query.
		Order(clause.OrderByColumn{Column: clause.Column{Name: "model_name"}}).
		Order(clause.OrderByColumn{Column: clause.Column{Name: "channel_name"}}).
		Order(clause.OrderByColumn{Column: clause.Column{Name: "channel_id"}}).
		Offset(startIdx).
		Limit(num).
		Find(&records).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, 0, err
	}
	return records, total, nil
}
