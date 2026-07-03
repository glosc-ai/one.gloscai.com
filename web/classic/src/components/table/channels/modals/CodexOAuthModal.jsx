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

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Button,
  Space,
  Typography,
  Input,
  Banner,
} from '@douyinfe/semi-ui';
import {
  API,
  copy,
  showError,
  showSuccess,
  showWarning,
} from '../../../../helpers';

const { Text } = Typography;

function formatCredential(rawKey) {
  try {
    return JSON.stringify(JSON.parse(rawKey), null, 2);
  } catch {
    return rawKey;
  }
}

const CodexOAuthModal = ({ visible, onCancel, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [authorizeUrl, setAuthorizeUrl] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');

  const canComplete = useMemo(
    () => Boolean(callbackUrl.trim()) && !completing,
    [callbackUrl, completing],
  );

  const startOAuth = async () => {
    setLoading(true);
    try {
      const res = await API.post(
        '/api/channel/codex/oauth/start',
        {},
        { skipErrorHandler: true },
      );
      if (!res?.data?.success) {
        throw new Error(res?.data?.message || t('启动授权失败'));
      }

      const url = res?.data?.data?.authorize_url || '';
      if (!url) {
        throw new Error(t('响应缺少授权链接'));
      }

      setAuthorizeUrl(url);
      try {
        window.open(url, '_blank', 'noopener,noreferrer');
        showSuccess(t('已打开授权页面'));
      } catch (error) {
        console.warn('Failed to open Codex authorization page:', error);
        showWarning(t('请手动复制并打开授权链接'));
      }
    } catch (error) {
      showError(error?.message || t('启动授权失败'));
    } finally {
      setLoading(false);
    }
  };

  const completeOAuth = async () => {
    const input = callbackUrl.trim();
    if (!input) {
      showError(t('请粘贴回调 URL'));
      return;
    }

    setCompleting(true);
    try {
      const res = await API.post(
        '/api/channel/codex/oauth/complete',
        { input },
        { skipErrorHandler: true, disableDuplicate: true },
      );
      if (!res?.data?.success) {
        throw new Error(res?.data?.message || t('授权失败'));
      }

      const key = res?.data?.data?.key || '';
      if (!key) {
        throw new Error(t('响应缺少凭据'));
      }

      onSuccess && onSuccess(formatCredential(key));
      showSuccess(t('已生成授权凭据'));
      onCancel && onCancel();
    } catch (error) {
      showError(error?.message || t('授权失败'));
    } finally {
      setCompleting(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setAuthorizeUrl('');
    setCallbackUrl('');
  }, [visible]);

  return (
    <Modal
      title={t('Codex 授权')}
      visible={visible}
      onCancel={onCancel}
      maskClosable={false}
      closeOnEsc
      width={720}
      footer={
        <Space>
          <Button
            theme='borderless'
            onClick={onCancel}
            disabled={loading || completing}
          >
            {t('取消')}
          </Button>
          <Button
            theme='solid'
            type='primary'
            onClick={completeOAuth}
            loading={completing}
            disabled={!canComplete}
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
            '1) 点击「打开授权页面」并完成登录；2) 浏览器可能跳转到 localhost，页面打不开也没关系；3) 复制地址栏完整 URL 粘贴到下方；4) 点击「生成并填入」。',
          )}
        />

        <Space wrap>
          <Button type='primary' onClick={startOAuth} loading={loading}>
            {t('打开授权页面')}
          </Button>
          <Button
            theme='outline'
            disabled={!authorizeUrl || loading}
            onClick={() => copy(authorizeUrl)}
          >
            {t('复制授权链接')}
          </Button>
        </Space>

        <Input
          value={callbackUrl}
          onChange={setCallbackUrl}
          placeholder={t('粘贴完整回调 URL（包含 code 和 state）')}
          autoComplete='off'
          spellCheck={false}
        />

        <Text type='tertiary' size='small'>
          {t(
            '说明：生成结果是可直接粘贴到渠道密钥里的 JSON（包含 access_token / refresh_token / account_id）。',
          )}
        </Text>
      </Space>
    </Modal>
  );
};

export default CodexOAuthModal;
