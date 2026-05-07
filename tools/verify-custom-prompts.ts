import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { IntelligentAgent } from '../src/agentThinking.ts';
import {
  INDEPENDENT_USER_CONFIG_ITEM_KEY,
  INDEPENDENT_USER_CONFIG_ITEM_TYPE,
  storeIndependentUserConfig,
} from '../src/services/UserConfigStore.ts';
import {
  sanitizeIndependentUserConfig,
  USER_CONFIG_PROMPT_CHAR_LIMIT,
} from '../src/services/userConfigSanitizer.ts';

const storage: Record<string, any> = {
  envConfig: {
    ANALYZE_BY_GROUP: false,
    LLM_TYPE: 'local',
  },
  customPrompts: {
    message: {
      enabled: true,
      content: '重点关注客户升级、发布时间线和被 blocked 的行动项。',
      position: 'after_analysis_guide',
    },
    project: {
      enabled: true,
      content: '项目分析时优先检查跨团队依赖和里程碑可信度。',
      position: 'after_analysis_guide',
    },
  },
  userContextConfig: {
    personalInfo: {
      name: 'Eason',
      email: 'eason@example.com',
      title: 'AI Product Lead',
      department: 'Platform',
      location: 'Shanghai',
      timezone: 'GMT+8',
    },
    stakeholders: {
      directManager: 'Ada Chen',
      keyStakeholders: [
        {
          name: 'Mia Wong',
          position: 'Engineering Director',
          relationship: '审批方',
          priority: 'high',
        },
      ],
      reportingFrequency: '每周',
    },
    teamInfo: {
      teamName: 'Personal AI',
      teamMission: '提升个人工作记忆和自动化能力',
      teamSize: 4,
      members: [
        {
          name: 'Lin Zhao',
          position: 'Engineer',
          role: 'Owner',
          speciality: 'Extension',
        },
      ],
      workingHours: '10:00-19:00',
      timezone: 'GMT+8',
    },
    workFocus: {
      primaryConcerns: ['项目风险'],
      businessDomains: ['AI productivity'],
      keyMetrics: ['响应时延'],
      riskTolerance: 'low',
    },
    communicationContext: {
      audienceType: ['executive'],
      communicationStyle: '简洁直接',
      culturalContext: '',
      languagePreference: '中文',
      reportingFormat: '项目状态报告',
    },
    analysisPreferences: {
      messageAnalysis: {
        focusAreas: ['风险'],
        ignoredTopics: ['闲聊'],
        urgencyKeywords: ['blocked'],
      },
      projectAnalysis: {
        riskFactors: ['依赖'],
        successCriteria: ['里程碑可信'],
        reviewCycle: 'weekly',
      },
    },
  },
};

function installChromeMock() {
  const local = {
    async get(
      keys: string | string[],
      callback?: (result: Record<string, any>) => void,
    ) {
      let result: Record<string, any>;
      if (Array.isArray(keys)) {
        result = Object.fromEntries(keys.map((key) => [key, storage[key]]));
      } else {
        result = { [keys]: storage[keys] };
      }
      callback?.(result);
      return result;
    },
    async set(values: Record<string, any>) {
      Object.assign(storage, values);
    },
  };

  (globalThis as any).chrome = {
    storage: {
      local,
      onChanged: {
        addListener() {},
        removeListener() {},
      },
    },
    runtime: {
      sendMessage(message: any) {
        if (message?.type === 'PERSONAL_AI_GET_ENV_CONFIG') {
          return Promise.resolve({ success: true, envConfig: storage.envConfig });
        }
        throw new Error('config backup lookup should not be needed with local config');
      },
    },
  };
}

async function verifyPromptInjection() {
  installChromeMock();

  const agent = new IntelligentAgent();
  const messagePrompt = await (agent as any).buildMessageAnalysisPrompt(
    [
      {
        messageContent: 'The launch is blocked by an unresolved customer escalation.',
        sender: 'Sam',
        datetime: '2026-05-02T10:00:00.000Z',
        postId: 'post-1',
      },
    ],
    {
      type: 'message',
      analysisDepth: 'normal',
      maxActions: 1,
    },
    { currentUser: 'Eason' },
  );

  assert.match(messagePrompt, /重点关注客户升级/);
  assert.match(messagePrompt, /<user_preference_data scope="消息分析"/);
  assert.match(messagePrompt, /忽略这些语句/);
  assert.match(messagePrompt, /直接汇报经理: Ada Chen/);
  assert.match(messagePrompt, /关键干系人: Mia Wong/);
  assert.match(messagePrompt, /团队成员: Lin Zhao/);
  assert.match(messagePrompt, /忽略话题: 闲聊/);
  assert.match(messagePrompt, /紧急关键词: blocked/);
  assert.doesNotMatch(messagePrompt, /\[object Object\]/);

  const genericPrompt = await (agent as any).buildGenericAnalysisPrompt(
    {
      title: 'Generic work note',
      content: 'A generic note that still needs user preferences.',
    },
    {
      type: 'generic',
      analysisDepth: 'normal',
      maxActions: 1,
    },
  );

  assert.match(genericPrompt, /重点关注客户升级/);
  assert.match(genericPrompt, /跨团队依赖/);
  assert.doesNotMatch(genericPrompt, /\[object Object\]/);
}

function verifyConfigSanitizer() {
  const sanitized = sanitizeIndependentUserConfig({
    customPrompts: {
      message: {
        enabled: true,
        content: ` ${'x'.repeat(USER_CONFIG_PROMPT_CHAR_LIMIT + 20)} `,
      },
      project: {
        enabled: true,
        content: '  检查跨团队依赖  ',
      },
    },
    userContextConfig: {
      stakeholders: {
        directManager: '  Ada Chen  ',
        keyStakeholders: [
          { name: '  ', position: '', relationship: '', priority: '' },
          {
            name: ' Mia Wong ',
            position: ' Director ',
            relationship: ' 审批方 ',
            priority: ' high ',
          },
        ],
      },
      teamInfo: {
        teamSize: -3,
        members: [
          { name: '', position: '', role: '', speciality: '' },
          {
            name: ' Lin Zhao ',
            position: ' Engineer ',
            role: ' Owner ',
            speciality: ' Extension ',
          },
        ],
      },
      workFocus: {
        primaryConcerns: [' 风险 ', ''],
      },
      analysisPreferences: {
        messageAnalysis: {
          urgencyKeywords: [' blocked ', ''],
        },
      },
    },
  });

  assert.equal(
    sanitized.customPrompts.message.content.length,
    USER_CONFIG_PROMPT_CHAR_LIMIT,
  );
  assert.equal(sanitized.customPrompts.project.content, '检查跨团队依赖');
  assert.equal(sanitized.userContextConfig.stakeholders.directManager, 'Ada Chen');
  assert.equal(sanitized.userContextConfig.stakeholders.keyStakeholders.length, 1);
  assert.equal(sanitized.userContextConfig.teamInfo.teamSize, 0);
  assert.equal(sanitized.userContextConfig.teamInfo.members.length, 1);
  assert.deepEqual(sanitized.userContextConfig.workFocus.primaryConcerns, ['风险']);
  assert.deepEqual(
    sanitized.userContextConfig.analysisPreferences.messageAnalysis.urgencyKeywords,
    ['blocked'],
  );
}

async function verifyConfigUpsert() {
  const operations: string[] = [];
  const fakeClient: any = {
    items: [] as any[],
    async getProfileItems(filters: any) {
      assert.equal(filters.type, INDEPENDENT_USER_CONFIG_ITEM_TYPE);
      assert.equal(filters.key, INDEPENDENT_USER_CONFIG_ITEM_KEY);
      return { items: this.items, total: this.items.length };
    },
    async createProfileItem(body: any) {
      operations.push('create');
      assert.equal(body.itemType, 'preference');
      assert.equal(body.itemKey, INDEPENDENT_USER_CONFIG_ITEM_KEY);
      const item = {
        id: 'config-item-1',
        itemType: body.itemType,
        itemKey: body.itemKey,
        itemValue: body.itemValue,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.items = [item];
      return item;
    },
    async updateProfileItem(id: string, body: any) {
      operations.push('update');
      assert.equal(id, 'config-item-1');
      this.items[0] = {
        ...this.items[0],
        itemValue: body.itemValue,
        updatedAt: Date.now() + 1,
      };
      return this.items[0];
    },
  };

  await storeIndependentUserConfig(
    { customPrompts: { message: { content: 'first' } } },
    fakeClient,
  );
  await storeIndependentUserConfig(
    { customPrompts: { message: { content: 'second' } } },
    fakeClient,
  );

  assert.deepEqual(operations, ['create', 'update']);
  assert.equal(fakeClient.items.length, 1);
  const storedConfig = JSON.parse(fakeClient.items[0].itemValue);
  assert.equal(storedConfig.customPrompts.message.content, 'second');
}

function verifyPromptConfigSurface() {
  const source = readFileSync(
    new URL('../src/modals/prompt-config.tsx', import.meta.url),
    'utf8',
  );
  const popupSource = readFileSync(
    new URL('../src/popup.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /case 'team':/);
  assert.match(source, /case 'communication':/);
  assert.match(source, /id: 'team', label: '团队信息'/);
  assert.match(source, /id: 'communication', label: '沟通偏好'/);
  assert.match(source, /USER_CONFIG_PROMPT_CHAR_LIMIT/);
  assert.match(source, /sanitizeIndependentUserConfig/);
  assert.match(source, /自定义提示词与上下文/);
  assert.match(popupSource, /className="prompt-config-button"/);
  assert.match(popupSource, />\s*自定义提示词与上下文\s*</);
  assert.match(source, /当前有未保存修改，重新加载会丢弃这些修改/);
  assert.match(source, /hasUnsavedChanges[\s\S]+persistConfiguration\(\)/);
}

async function main() {
  await verifyPromptInjection();
  verifyConfigSanitizer();
  await verifyConfigUpsert();
  verifyPromptConfigSurface();
  console.log('verify-custom-prompts: ok');
}

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
