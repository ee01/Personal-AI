import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyMessage, extractMemoContent, convertToMemoItems } from '../memoClassifier.js';
import type { MemoType } from '../memoTypes.js';

test('classifyMessage should classify parking location', () => {
  const result = classifyMessage('车停在B2层A区123号');
  assert.equal(result.type, 'parking');
  assert.ok(result.confidence > 0.7);
});

test('classifyMessage should classify where items are', () => {
  const result = classifyMessage('钥匙放在抽屉里了');
  assert.equal(result.type, 'where');
});

test('classifyMessage should classify todo items', () => {
  const result = classifyMessage('记得明天开会');
  assert.equal(result.type, 'todo');
});

test('classifyMessage should classify shopping list', () => {
  const result = classifyMessage('要买：牛奶、面包、鸡蛋');
  assert.equal(result.type, 'shopping');
});

test('classifyMessage should classify important dates', () => {
  const result = classifyMessage('妈妈生日是3月15号');
  assert.equal(result.type, 'important_date');
});

test('classifyMessage should classify card numbers', () => {
  const result = classifyMessage('身份证号：123456789012345678');
  assert.equal(result.type, 'card');
  assert.ok(result.confidence > 0.6);
});

test('classifyMessage should classify phone numbers', () => {
  const result = classifyMessage('我的手机号是13812345678');
  assert.equal(result.type, 'number');
});

test('classifyMessage should classify health data', () => {
  const result = classifyMessage('体重68.5kg，血压120/80');
  assert.equal(result.type, 'health');
});

test('classifyMessage should classify quotes', () => {
  const result = classifyMessage('"人生如梦"—苏轼');
  assert.equal(result.type, 'quote');
});

test('classifyMessage should default to note for unclear content', () => {
  const result = classifyMessage('这是一段普通的文字');
  assert.equal(result.type, 'note');
});

test('extractMemoContent should extract parking location', () => {
  const metadata = extractMemoContent('车停在B2层A区123号', 'parking');
  assert.ok(metadata?.location);
});

test('extractMemoContent should extract date from important_date', () => {
  const metadata = extractMemoContent('妈妈生日是2024年3月15号', 'important_date');
  assert.equal(metadata?.dueDate, '2024-03-15');
});

test('extractMemoContent should mark card as high importance', () => {
  const metadata = extractMemoContent('身份证号：123456789012345678', 'card');
  assert.equal(metadata?.importance, 'high');
});

test('extractMemoContent should extract simple date format', () => {
  const metadata = extractMemoContent('会议安排在3月15号', 'important_date');
  assert.ok(metadata?.dueDate?.match(/^\d{4}-03-15$/));
});

test('convertToMemoItems should convert items with classification', () => {
  const items = [
    { title: '停车位置', body: '车停在B2层A区123号' },
    { title: '待办事项', body: '记得明天开会' },
  ];

  const memoItems = convertToMemoItems(items);

  assert.equal(memoItems.length, 2);
  assert.equal(memoItems[0].type, 'parking');
  assert.equal(memoItems[1].type, 'todo');
  assert.equal(memoItems[0].metadata?.source, 'memory_service');
});

test('priority matching should prioritize parking over generic location', () => {
  // 停车位置有更高优先级
  const result = classifyMessage('停车场地址：B2层A区');
  assert.equal(result.type, 'parking');
});

test('priority matching should prioritize card over number', () => {
  // 证件卡号有更高优先级
  const result = classifyMessage('身份证号码123456789012345678');
  assert.equal(result.type, 'card');
});
