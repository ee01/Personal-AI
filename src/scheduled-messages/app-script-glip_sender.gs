/**
 * RingCentral Glip/Team Messaging sender configuration.
 *
 * Fill clientId/clientSecret/jwt to send through the RingCentral API directly.
 * If credentials are empty, scheduled messages continue to use the email gateway.
 */
const GLIP_RINGCENTRAL_CONFIG = {
  server: 'https://platform.ringcentral.com',
  clientId: '',
  clientSecret: '',
  jwt: '',
  directoryRecordCount: '1000',
  mentionMap: {
    // Optional manual overrides, for example:
    // 'esone.qiu': '123456789'
  },
  failOnUnresolvedMentions: true,
  enableTeamMentionShortcut: true,
  fallbackToEmailOnMissingConfig: true,
  fallbackToEmailOnError: true,
};

const GLIP_EMAIL_CONFIG = {
  replyDomain: 'reply.ringcentral.glip.com',
  defaultBcc: 'esone.qiu@ringcentral.com',
};

function sendGlipMessage(options) {
  const glipTarget = _toTrimmedString_(options && options.glipTarget);
  const targets = _splitGlipTargets_(glipTarget);
  const subject = _toTrimmedString_(options && options.subject) || 'Glip 推送提醒';
  const messageText = _toString_(options && options.messageText);
  const htmlBody = _toString_(options && options.htmlBody) || _textToHtml_(messageText);
  const attachments = (options && options.attachments) || [];
  const bcc = options && Object.prototype.hasOwnProperty.call(options, 'bcc')
    ? options.bcc
    : GLIP_EMAIL_CONFIG.defaultBcc;

  if (targets.length === 0) {
    throw new Error('glipTarget is required');
  }

  if (!_isRingCentralConfigured_()) {
    if (!GLIP_RINGCENTRAL_CONFIG.fallbackToEmailOnMissingConfig) {
      throw new Error('RingCentral clientId/clientSecret/jwt is required');
    }
    Logger.log('RingCentral credentials 未配置，fallback 使用邮件方式推送: ' + glipTarget);
    return _sendGlipMessageByEmail_({
      glipTarget: glipTarget,
      subject: subject,
      htmlBody: htmlBody,
      attachments: attachments,
      bcc: bcc,
    });
  }

  const rcDelivery = _sendGlipMessageByRingCentral_(targets, messageText, attachments);
  if (rcDelivery.failedTargets.length === 0) {
    return rcDelivery;
  }

  Logger.log('RingCentral API 推送失败: ' + rcDelivery.errors.join('; '));
  if (!GLIP_RINGCENTRAL_CONFIG.fallbackToEmailOnError) {
    throw new Error('RingCentral API 推送失败: ' + rcDelivery.errors.join('; '));
  }

  Logger.log('Fallback 使用邮件方式推送失败目标: ' + rcDelivery.failedTargets.join(','));
  const emailDelivery = _sendGlipMessageByEmail_({
    glipTarget: rcDelivery.failedTargets.join(','),
    subject: subject,
    htmlBody: htmlBody,
    attachments: attachments,
    bcc: bcc,
  });

  return {
    method: rcDelivery.results.length > 0 ? 'ringcentral+email' : 'email',
    targets: targets,
    results: rcDelivery.results.concat(emailDelivery.results),
    errors: rcDelivery.errors,
  };
}

function _sendGlipMessageByRingCentral_(targets, messageText, attachments) {
  const accessToken = _getRingCentralAccessToken_();
  const results = [];
  const failedTargets = [];
  const errors = [];

  for (var i = 0; i < targets.length; i++) {
    try {
      const targetInfo = _resolveGlipTarget_(accessToken, targets[i]);
      const finalText = _prepareRingCentralMessageText_(accessToken, messageText, targetInfo);
      const uploadedFiles = [];
      const postAttachments = [];
      for (var j = 0; j < attachments.length; j++) {
        const uploadResponse = _uploadRingCentralFileForPost_(accessToken, attachments[j]);
        uploadedFiles.push(uploadResponse);
        postAttachments.push.apply(postAttachments, _filePostAttachmentsFromUploadResponse_(uploadResponse));
      }

      const targetResults = [];
      if (finalText || postAttachments.length > 0) {
        targetResults.push(_postRingCentralMessage_(accessToken, targetInfo.chatId, finalText, postAttachments));
      }

      results.push({
        target: targets[i],
        chatId: targetInfo.chatId,
        targetType: targetInfo.targetType,
        finalText: finalText,
        uploadedFiles: uploadedFiles,
        responses: targetResults,
      });
    } catch (e) {
      failedTargets.push(targets[i]);
      errors.push(targets[i] + ': ' + e.message);
    }
  }

  return {
    method: 'ringcentral',
    targets: targets,
    results: results,
    failedTargets: failedTargets,
    errors: errors,
  };
}

function _getRingCentralAccessToken_() {
  const cache = CacheService.getScriptCache();
  const cachedToken = cache.get('ringcentral_access_token');
  if (cachedToken) {
    return cachedToken;
  }

  const tokenUrl = _joinUrl_(GLIP_RINGCENTRAL_CONFIG.server, '/restapi/oauth/token');
  const basic = Utilities.base64Encode(
    GLIP_RINGCENTRAL_CONFIG.clientId + ':' + GLIP_RINGCENTRAL_CONFIG.clientSecret
  );
  const payload = [
    'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer'),
    'assertion=' + encodeURIComponent(GLIP_RINGCENTRAL_CONFIG.jwt),
  ].join('&');

  const response = UrlFetchApp.fetch(tokenUrl, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    headers: {
      Accept: 'application/json',
      Authorization: 'Basic ' + basic,
    },
    payload: payload,
    muteHttpExceptions: true,
  });

  const statusCode = response.getResponseCode();
  const body = response.getContentText();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error('RingCentral OAuth returned HTTP ' + statusCode + ': ' + body);
  }

  const data = JSON.parse(body || '{}');
  if (!data.access_token) {
    throw new Error('RingCentral OAuth response has no access_token: ' + body);
  }

  const ttlSeconds = Math.max(60, Math.min(Number(data.expires_in || 3600) - 120, 3600));
  cache.put('ringcentral_access_token', data.access_token, ttlSeconds);
  return data.access_token;
}

function _resolveGlipTarget_(accessToken, targetInput) {
  const target = _toTrimmedString_(targetInput);
  if (!target) {
    throw new Error('chatId or personName is required');
  }

  if (/^\d+$/.test(target)) {
    return {
      targetType: 'chat',
      chatId: target,
      personId: '',
    };
  }

  const personId = _resolvePersonIdByHandle_(accessToken, target, null);
  const conversation = _ringCentralJsonRequest_(accessToken, 'post', '/team-messaging/v1/conversations', {
    members: [{ id: personId }],
  });

  if (!conversation.id) {
    throw new Error('Conversation response has no id: ' + JSON.stringify(conversation));
  }

  return {
    targetType: 'person',
    chatId: String(conversation.id),
    personId: String(personId),
  };
}

function _prepareRingCentralMessageText_(accessToken, messageText, targetInfo) {
  var text = _toString_(messageText);
  text = _replaceTeamMentionShortcut_(text, targetInfo);

  const mentionMatches = _collectPersonMentionHandles_(text);
  if (mentionMatches.length === 0) {
    return text;
  }

  const records = _fetchDirectoryRecords_(accessToken);
  const resolved = {};
  const unresolved = [];

  for (var i = 0; i < mentionMatches.length; i++) {
    const handle = mentionMatches[i];
    const handleKey = _personHandleKey_(handle);
    if (resolved[handleKey]) {
      continue;
    }

    try {
      resolved[handleKey] = _resolvePersonIdByHandle_(accessToken, handle, records);
    } catch (e) {
      unresolved.push(handle + ': ' + e.message);
    }
  }

  if (unresolved.length > 0 && GLIP_RINGCENTRAL_CONFIG.failOnUnresolvedMentions) {
    throw new Error('Unresolved mention(s): ' + unresolved.join('; '));
  }

  return text.replace(/(^|[^\w.-])@([A-Za-z][A-Za-z0-9'-]*)\.([A-Za-z][A-Za-z0-9'-]*)\b/g, function(
    match,
    prefix,
    first,
    last
  ) {
    const handleKey = _personHandleKey_(first + '.' + last);
    return resolved[handleKey] ? prefix + '![:Person](' + resolved[handleKey] + ')' : match;
  });
}

function _replaceTeamMentionShortcut_(text, targetInfo) {
  if (!GLIP_RINGCENTRAL_CONFIG.enableTeamMentionShortcut || !targetInfo || targetInfo.targetType !== 'chat') {
    return text;
  }

  return _toString_(text).replace(/(^|[^\w.-])@team\b/gi, function(match, prefix) {
    return prefix + '![:Team](' + targetInfo.chatId + ')';
  });
}

function _postRingCentralMessage_(accessToken, chatId, text, attachments) {
  const body = {};
  if (text) {
    body.text = text;
  }
  if (attachments && attachments.length > 0) {
    body.attachments = attachments;
  }

  return _ringCentralJsonRequest_(accessToken, 'post', '/team-messaging/v1/chats/' + encodeURIComponent(chatId) + '/posts', body);
}

function _uploadRingCentralFileForPost_(accessToken, attachment) {
  const blob = attachment;
  const name = blob && blob.getName ? (blob.getName() || 'attachment') : 'attachment';
  const contentType = blob && blob.getContentType ? (blob.getContentType() || 'application/octet-stream') : 'application/octet-stream';
  const bytes = blob && blob.getBytes ? blob.getBytes() : blob;

  return _ringCentralRawRequest_(
    accessToken,
    'post',
    '/team-messaging/v1/files',
    {
      name: name,
    },
    bytes,
    contentType
  );
}

function _filePostAttachmentsFromUploadResponse_(uploadResponse) {
  const files = Array.isArray(uploadResponse) ? uploadResponse : [uploadResponse];
  const attachments = [];

  for (var i = 0; i < files.length; i++) {
    const file = files[i] || {};
    if (!file.id) {
      throw new Error('RingCentral file upload response has no id: ' + JSON.stringify(uploadResponse));
    }

    attachments.push({
      id: String(file.id),
      type: 'File',
    });
  }

  return attachments;
}

function _resolvePersonIdByHandle_(accessToken, handle, directoryRecords) {
  const handleKey = _personHandleKey_(handle);
  const manualId = _manualMentionPersonId_(handleKey, handle);
  if (manualId) {
    return manualId;
  }

  const records = directoryRecords || [];
  const matchedIds = _findPersonIdsInRecords_(records, handleKey);
  if (matchedIds.length === 1) {
    return matchedIds[0];
  }
  if (matchedIds.length > 1) {
    throw new Error('Multiple directory entries matched ' + handle);
  }

  const searchBody = _ringCentralJsonRequest_(
    accessToken,
    'post',
    '/restapi/v1.0/account/~/directory/entries/search',
    { searchString: handleKey }
  );
  const searchIds = _findPersonIdsInRecords_(_recordsFromDirectoryResponse_(searchBody), handleKey);
  if (searchIds.length === 1) {
    return searchIds[0];
  }
  if (searchIds.length > 1) {
    throw new Error('Multiple directory entries matched ' + handle);
  }

  throw new Error('Cannot resolve personName ' + handle);
}

function _fetchDirectoryRecords_(accessToken) {
  const body = _ringCentralRawRequest_(
    accessToken,
    'get',
    '/restapi/v1.0/account/~/directory/entries',
    { recordCount: GLIP_RINGCENTRAL_CONFIG.directoryRecordCount },
    null,
    null
  );
  return _recordsFromDirectoryResponse_(body);
}

function _ringCentralJsonRequest_(accessToken, method, path, body) {
  return _ringCentralRawRequest_(accessToken, method, path, null, JSON.stringify(body || {}), 'application/json');
}

function _ringCentralRawRequest_(accessToken, method, path, params, payload, contentType) {
  const url = _joinUrl_(GLIP_RINGCENTRAL_CONFIG.server, path) + _queryString_(params);
  const options = {
    method: method,
    headers: {
      Accept: 'application/json',
      Authorization: 'Bearer ' + accessToken,
    },
    muteHttpExceptions: true,
  };

  if (payload !== null && payload !== undefined) {
    options.payload = payload;
  }
  if (contentType) {
    options.contentType = contentType;
  }

  const response = UrlFetchApp.fetch(url, options);
  const statusCode = response.getResponseCode();
  const responseBody = response.getContentText();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error('RingCentral API returned HTTP ' + statusCode + ': ' + responseBody);
  }

  return _tryParseJson_(responseBody) || responseBody;
}

function _findPersonIdsInRecords_(records, handleKey) {
  const matches = [];
  for (var i = 0; i < records.length; i++) {
    const record = records[i] || {};
    const personId = record.id;
    if (!personId) {
      continue;
    }
    if (_recordNameKey_(record) === handleKey || _recordEmailKey_(record) === handleKey) {
      matches.push(String(personId));
    }
  }
  return _uniqueStrings_(matches);
}

function _collectPersonMentionHandles_(text) {
  const handles = [];
  const re = /(^|[^\w.-])@([A-Za-z][A-Za-z0-9'-]*)\.([A-Za-z][A-Za-z0-9'-]*)\b/g;
  var match;
  while ((match = re.exec(_toString_(text))) !== null) {
    handles.push(match[2] + '.' + match[3]);
  }
  return _uniqueStrings_(handles.map(_personHandleKey_));
}

function _manualMentionPersonId_(handleKey, handle) {
  const mentionMap = GLIP_RINGCENTRAL_CONFIG.mentionMap || {};
  return mentionMap[handleKey] || mentionMap['@' + handleKey] || mentionMap[handle] || mentionMap['@' + handle] || '';
}

function _personHandleKey_(value) {
  var target = _toTrimmedString_(value);
  if (target.charAt(0) === '@') {
    target = target.slice(1).trim();
  }
  if (target.indexOf('@') !== -1) {
    target = target.split('@')[0];
  }
  if (target.indexOf('.') === -1) {
    throw new Error('personName must use first.last format: ' + value);
  }
  const parts = target.split('.');
  if (!parts[0] || !parts[1]) {
    throw new Error('personName must use first.last format: ' + value);
  }
  return (parts[0] + '.' + parts.slice(1).join('.')).toLowerCase();
}

function _recordNameKey_(record) {
  return (_toTrimmedString_(record.firstName) + '.' + _toTrimmedString_(record.lastName)).toLowerCase();
}

function _recordEmailKey_(record) {
  const email = _toTrimmedString_(record.email);
  return email ? email.split('@')[0].toLowerCase() : '';
}

function _recordsFromDirectoryResponse_(body) {
  const data = typeof body === 'string' ? (_tryParseJson_(body) || {}) : (body || {});
  return data.records || data.contacts || [];
}

function _sendGlipMessageByEmail_(options) {
  const attachments = options.attachments || [];
  const mail = {
    to: _buildGlipReplyEmail_(options.glipTarget),
    subject: options.subject,
    htmlBody: options.htmlBody,
    attachments: attachments,
  };

  if (options.bcc) {
    mail.bcc = options.bcc;
  }

  MailApp.sendEmail(mail);

  return {
    method: 'email',
    targets: _splitGlipTargets_(options.glipTarget),
    results: [],
  };
}

function _isRingCentralConfigured_() {
  return !!(
    _toTrimmedString_(GLIP_RINGCENTRAL_CONFIG.server) &&
    _toTrimmedString_(GLIP_RINGCENTRAL_CONFIG.clientId) &&
    _toTrimmedString_(GLIP_RINGCENTRAL_CONFIG.clientSecret) &&
    _toTrimmedString_(GLIP_RINGCENTRAL_CONFIG.jwt)
  );
}

function _splitGlipTargets_(glipTarget) {
  return _toTrimmedString_(glipTarget)
    .split(',')
    .map(function(target) {
      return target.trim();
    })
    .filter(function(target) {
      return !!target;
    });
}

function _buildGlipReplyEmail_(glipTarget) {
  return _splitGlipTargets_(glipTarget).join('+') + '@' + GLIP_EMAIL_CONFIG.replyDomain;
}

function _textToHtml_(text) {
  return _toString_(text).replace(/\n/g, '<br />');
}

function _joinUrl_(baseUrl, path) {
  return String(baseUrl || '').replace(/\/+$/, '') + '/' + String(path || '').replace(/^\/+/, '');
}

function _queryString_(params) {
  if (!params) {
    return '';
  }

  const pairs = [];
  Object.keys(params).forEach(function(key) {
    if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
      pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
    }
  });
  return pairs.length > 0 ? '?' + pairs.join('&') : '';
}

function _uniqueStrings_(values) {
  const seen = {};
  const result = [];
  for (var i = 0; i < values.length; i++) {
    const value = _toString_(values[i]);
    if (!seen[value]) {
      seen[value] = true;
      result.push(value);
    }
  }
  return result;
}

function _toString_(value) {
  return value === null || value === undefined ? '' : String(value);
}

function _toTrimmedString_(value) {
  return _toString_(value).trim();
}

function _tryParseJson_(value) {
  try {
    return JSON.parse(value || '{}');
  } catch (e) {
    return null;
  }
}
