# 命名规范文档

*最后更新: 2024-10-24*

## 📋 实体类型命名规范

本项目中涉及实体的命名有**两种不同用途**，遵循业界标准规范：

### 1️⃣ Entity Type（实体类型）- 单数

**用途**: 标识单个实体的类型

**规范**: **单数形式 + 首字母大写**

```typescript
// ✅ 正确示例
interface MemoryEntity {
  type: 'Person' | 'Project' | 'Topic' | 'Organization' | 'Document' | 'Technology';
  // ...
}

const entity = {
  type: 'Person',  // ✅ 单数、首字母大写
  name: 'Colin Liu'
};

// ❌ 错误示例
type: 'People'   // ❌ 不应该用复数
type: 'person'   // ❌ 首字母应大写（除非是 UserProfile 系统）
```

**适用场景**:
- `MemoryEntity.type`
- `GraphEntity.type`
- `switch (entity.type)` 分支判断
- 类型定义中的联合类型

---

### 2️⃣ Collection/Array Field（集合字段名）- 复数

**用途**: 表示多个实体的集合

**规范**: **复数形式 + 小写**

```typescript
// ✅ 正确示例
interface RelatedData {
  people: Array<{        // ✅ 复数，表示"多个人员"
    id: string;
    name: string;
    role: string;
  }>;
  projects: Array<{...}>;  // ✅ 复数，表示"多个项目"
  topics: Array<{...}>;    // ✅ 复数，表示"多个主题"
}

interface ExtractedEntities {
  people: string[];      // ✅ 提取的多个人物
  projects: string[];    // ✅ 提取的多个项目
  topics: string[];      // ✅ 提取的多个主题
}

// ❌ 错误示例
interface WrongExample {
  person: Person[];  // ❌ 字段名应该用复数
  People: Person[];  // ❌ 首字母不应大写
}
```

**适用场景**:
- `relatedData.people` - 关联的人员列表
- `entities.people` - 提取的人物列表
- `interests.people` - 用户关注的人物
- JSON 响应中的数组字段名

---

### 3️⃣ UserProfile 系统特例

**UserProfile 系统**使用**全小写**的类型名，这是该系统的独立命名规范：

```typescript
// UserProfile 系统专用
interface UserInterestItem {
  type: 'person' | 'project' | 'topic' | 'jira' | 'technology' | 'document';
  //    ^^^^^^^^ 小写，这是 UserProfile 系统的规范
}

// 与 MemoryEntity 系统的映射关系
const typeMapping = {
  'Person': 'person',        // MemoryEntity → UserProfile
  'Project': 'project',
  'Topic': 'topic',
  'Task': 'jira',
  'Technology': 'technology',
  'Document': 'document'
};
```

**说明**: UserProfile 系统的类型名全部小写，以区分于 MemoryEntity 系统，并与其内部存储键名保持一致。

---

## 🎯 业界标准对比

这个命名规范遵循多个业界标准：

### REST API 设计规范
```
GET /api/users     ← 复数，表示集合
GET /api/users/1   ← 单数ID，返回单个资源

Response:
{
  "users": [...]   ← 复数字段名
}

User Model:
class User { }     ← 单数类名
```

### 数据库设计规范
```sql
-- 表名：复数
CREATE TABLE users (...);
CREATE TABLE projects (...);

-- 模型类：单数
class User extends Model { }
class Project extends Model { }
```

### TypeScript/JavaScript 惯例
```typescript
// 类型定义：单数
type Person = { ... };
type Project = { ... };

// 变量名（集合）：复数
const people: Person[] = [];
const projects: Project[] = [];
```

---

## 📋 快速检查清单

在编写代码时，使用以下清单检查命名是否正确：

- [ ] Entity Type 使用单数形式？（`'Person'` not `'People'`）
- [ ] Entity Type 首字母大写？（`'Person'` not `'person'`，UserProfile 系统除外）
- [ ] Array/Collection 字段名使用复数？（`people: []` not `person: []`）
- [ ] Array/Collection 字段名小写？（`people` not `People`）
- [ ] UserProfile 系统类型全部小写？（`'person'` not `'Person'`）

---

## 🔍 代码示例

### 完整示例 - MemoryEntity

```typescript
// 实体定义
const personEntity: MemoryEntity = {
  type: 'Person',  // ✅ 单数、首字母大写
  name: 'Colin Liu',
  relatedData: {
    people: [      // ✅ 复数字段名，表示"关联的多个人员"
      {
        id: 'person_zhang_san',
        name: '张三',
        role: '工程师'
      }
    ],
    projects: [    // ✅ 复数字段名
      { name: '项目A' }
    ]
  }
};

// 类型判断
switch (entity.type) {
  case 'Person':   // ✅ 单数
    // 处理人员实体
    break;
  case 'Project':  // ✅ 单数
    // 处理项目实体
    break;
}

// 实体提取结果
const extractedEntities = {
  people: ['Colin', 'Zhang San'],   // ✅ 复数字段名
  projects: ['Project A', 'Project B'],  // ✅ 复数字段名
  topics: ['AI', 'Development']    // ✅ 复数字段名
};
```

### 完整示例 - UserProfile

```typescript
// UserProfile 系统
const userInterest: UserInterestItem = {
  id: 'colin_liu',
  type: 'person',  // ✅ UserProfile 系统使用小写
  name: 'Colin Liu',
  currentWeight: 0.8
};

// 类型转换
function memoryTypeToProfileType(memoryType: string): string {
  const mapping = {
    'Person': 'person',
    'Project': 'project',
    'Topic': 'topic'
  };
  return mapping[memoryType];
}
```

---

## ⚠️ 常见错误

### 错误 1: Entity Type 使用复数
```typescript
// ❌ 错误
type: 'People'

// ✅ 正确
type: 'Person'
```

### 错误 2: Collection 字段使用单数
```typescript
// ❌ 错误
relatedData: {
  person: Array<Person>
}

// ✅ 正确
relatedData: {
  people: Array<Person>
}
```

### 错误 3: 混淆两个系统的命名
```typescript
// ❌ 错误：在 MemoryEntity 中使用 UserProfile 的命名
const entity: MemoryEntity = {
  type: 'person'  // ❌ 应该是 'Person'
};

// ❌ 错误：在 UserProfile 中使用 MemoryEntity 的命名
const interest: UserInterestItem = {
  type: 'Person'  // ❌ 应该是 'person'
};
```

---

## 🔄 历史遗留问题

如果在代码中发现不符合规范的命名，请按以下优先级处理：

1. **高优先级**: Entity Type 错误（如 `type: 'People'`）- 立即修复
2. **中优先级**: Collection 字段名错误（如 `person: []`）- 计划修复
3. **低优先级**: 注释或文档中的描述 - 逐步完善

---

## 📚 相关文档

- [实体记忆系统架构](./features/memory_system.md)
- [用户画像系统](./features/user_profile_system.md)
- [数据结构设计](./entity-id-unification.md)

---

*本文档确保项目中的命名规范保持一致，便于团队协作和代码维护。*


