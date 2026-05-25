/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Button,
  Space,
  Typography,
  Input,
  Banner,
} from '@douyinfe/semi-ui';
import { API, copy, showError, showSuccess } from '../../../../helpers';

const { Text } = Typography;

const GitHubCopilotOAuthModal = ({ visible, onCancel, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState('');
  const [userCode, setUserCode] = useState('');

  const startOAuth = async () => {
    setLoading(true);
    try {
      const res = await API.post(
        '/api/channel/github-copilot/oauth/start',
        {},
        { skipErrorHandler: true },
      );
      if (!res?.data?.success) {
        console.error('GitHub Copilot OAuth start failed:', res?.data?.message);
        throw new Error(res?.data?.message || t('启动授权失败'));
      }
      const url =
        res?.data?.data?.verification_url || res?.data?.data?.authorize_url || '';
      const code = res?.data?.data?.user_code || '';
      if (!url || !code) {
        console.error(
          'GitHub Copilot OAuth start response missing fields:',
          res?.data,
        );
        throw new Error(t('响应缺少授权信息'));
      }
      setVerificationUrl(url);
      setUserCode(code);
      window.open(url, '_blank', 'noopener,noreferrer');
      showSuccess(t('已打开授权页面'));
    } catch (error) {
      showError(error?.message || t('启动授权失败'));
    } finally {
      setLoading(false);
    }
  };

  const completeOAuth = async () => {
    if (!userCode) {
      showError(t('请先打开授权页面获取设备码'));
      return;
    }

    setLoading(true);
    try {
      const res = await API.post(
        '/api/channel/github-copilot/oauth/complete',
        {},
        { skipErrorHandler: true, disableDuplicate: true },
      );
      if (!res?.data?.success) {
        console.error('GitHub Copilot OAuth complete failed:', res?.data?.message);
        throw new Error(res?.data?.message || t('授权失败'));
      }

      const key = res?.data?.data?.key || '';
      if (!key) {
        console.error(
          'GitHub Copilot OAuth complete response missing key:',
          res?.data,
        );
        throw new Error(t('响应缺少凭据'));
      }

      onSuccess && onSuccess(key);
      showSuccess(t('已生成授权凭据'));
      onCancel && onCancel();
    } catch (error) {
      showError(error?.message || t('授权失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setVerificationUrl('');
    setUserCode('');
  }, [visible]);

  return (
    <Modal
      title={t('GitHub Copilot 授权')}
      visible={visible}
      onCancel={onCancel}
      maskClosable={false}
      closeOnEsc
      width={720}
      footer={
        <Space>
          <Button theme='borderless' onClick={onCancel} disabled={loading}>
            {t('取消')}
          </Button>
          <Button
            theme='solid'
            type='primary'
            onClick={completeOAuth}
            loading={loading}
          >
            {t('生成并填入')}
          </Button>
        </Space>
      }
    >
      <Space vertical spacing='tight' style={{ width: '100%' }}>
        <Banner
          type='info'
          description={t(
            '1) 点击「打开授权页面」；2) 在 GitHub 页面输入下方设备码并完成登录；3) 回到这里点击「生成并填入」。',
          )}
        />

        <Space wrap>
          <Button type='primary' onClick={startOAuth} loading={loading}>
            {t('打开授权页面')}
          </Button>
          <Button
            theme='outline'
            disabled={!verificationUrl || loading}
            onClick={() => copy(verificationUrl)}
          >
            {t('复制授权链接')}
          </Button>
          <Button
            theme='outline'
            disabled={!userCode || loading}
            onClick={() => copy(userCode)}
          >
            {t('复制设备码')}
          </Button>
        </Space>

        <Input
          value={userCode}
          readonly
          placeholder={t('点击「打开授权页面」获取设备码')}
        />

        <Text type='tertiary' size='small'>
          {t(
            '说明：生成结果是可直接粘贴到渠道密钥里的 JSON（包含 github_token）。',
          )}
        </Text>
      </Space>
    </Modal>
  );
};

export default GitHubCopilotOAuthModal;