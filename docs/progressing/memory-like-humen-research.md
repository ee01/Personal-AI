# 背景与目标

在这个项目中，我们要构建一个**仿人类记忆和自我思考的 AI 系统**。该系统应能像人脑一样完成以下任务：

- **自然联想与记忆优先级**：系统可以像人一样由一个念头自然联想到相关记忆，并优先提取**近期的或印象深刻的**事件。比如，当用户提到某项目时，系统会联想到最近阅读过的相关文档或对话。
- **自动记录与持续整理**：系统能够从用户**阅读的消息、浏览的网页、检索到的内容**中自动生成“记忆”条目，并在后台持续自我整理这些记忆——类似于人类睡眠做梦时对记忆进行重组和巩固。
- **迭代更新与真实世界对齐**：当系统发现某些**关键事实发生变更**时（例如项目发布日期多次修改），能自然获取**当前的正确值**并保留历史变化记录[\[1\]](https://pubmed.ncbi.nlm.nih.gov/17696170/#:~:text=of%20episodic%20memory%20based%20on,thus%20retrieve%20the%20memory%20of)。必要时系统应**主动提醒**用户这些变化，并**请求用户确认**如何处理旧信息（例如提醒清理过期的文档内容）。
- **形态与实现**：系统预计以 **Chrome 浏览器扩展（Manifest V3）** 前端 + 私有云后端服务的形式提供。但我们也会评估一种替代方案：**是否以后端 API 服务为核心**，让浏览器扩展仅承担数据采集和用户通知界面。
- **推理核心**：我们可以接受使用**Transformer 大模型(LLM)**作为主要推理引擎，但需要论证这样的方案在功能上**为何足够**，以及明确在哪些情况**需要引入其他算法或模块进行替代/增强**。例如，大模型在长期记忆方面的局限和解决方案边界。

以上是项目背景和核心目标的复述。如果与您的初始设想有任何出入，请指正。在下文中，我们将从脑科学与计算机科学文献出发，验证关键理念，并提出分层记忆系统的详细设计方案。

# 验证与引用关键文献 🔗

在设计人脑式记忆系统前，我们调研了多领域的经典理论和最新研究，重点考察以下方面：

1.  **互补学习系统（CLS）与海马索引理论**：大脑利用双重记忆系统分别处理情节记忆和语义记忆[\[2\]](https://pubmed.ncbi.nlm.nih.gov/22141588/#:~:text=This%20paper%20reviews%20the%20fate,including%20the%20following%3A%20the%20basic)。根据 _McClelland 等 (1995)_ 提出的互补学习系统理论，大脑需要两个专门的学习/记忆子系统：**海马体**具备快速、稀疏编码能力，用于迅速学习并存储具体情节；**新皮层**则通过慢速、重叠的学习逐渐从多个事件中提取抽象的语义结构[\[2\]](https://pubmed.ncbi.nlm.nih.gov/22141588/#:~:text=This%20paper%20reviews%20the%20fate,including%20the%20following%3A%20the%20basic)。这一点启示我们应将AI记忆分为“情节库”（快速记录具体事件）和“语义库”（逐步整合通用知识）。同时，_海马索引理论_（Teyler & Rudy）提出海马体对经历过的事件形成一个索引，记录各要素在新皮层的分布位置。当给出原始事件的**部分线索**时，海马体的索引可以**重新激活**新皮层中对应的整体模式，从而回忆出完整的情节[\[1\]](https://pubmed.ncbi.nlm.nih.gov/17696170/#:~:text=of%20episodic%20memory%20based%20on,thus%20retrieve%20the%20memory%20of)。这说明我们的系统应支持由线索触发整组记忆的能力，比如只根据项目代号就联想起完整的项目细节。
2.  **外部存储记忆模型 & 注意力与联想**：在机器学习领域，_Neural Turing Machine (NTM)_ 和 _Differentiable Neural Computer (DNC)_ 等模型证明了**可微分外部内存**对增强长时记忆的价值。它们通过读写头和内容寻址机制，让神经网络像程序一样使用可扩展的外存储[\[3\]](https://gwern.net/doc/reinforcement-learning/model-free/2016-graves.pdf#:~:text=without%20interference10%2C11,to%20an%20external%20memory%20matrix)[\[4\]](https://gwern.net/doc/reinforcement-learning/model-free/2016-graves.pdf#:~:text=The%20heads%20use%20three%20distinct,attend%20strongly%20to%20that%20location)。具体而言，DNC使用一种**内容查找**(content lookup)的注意力：控制器产生键向量，与内存每个位置内容计算相似度，从而以**部分匹配**的键值也能找到相关记忆，实现类似人脑**线索检索**的效果[\[4\]](https://gwern.net/doc/reinforcement-learning/model-free/2016-graves.pdf#:~:text=The%20heads%20use%20three%20distinct,attend%20strongly%20to%20that%20location)。这等价于一种**联想存储**——给定线索自动提取最相近的记忆。进一步，2020年 _Ramsauer 等_ 提出的“现代Hopfield网络”指出：Transformer 的多头**注意力机制本质上等价于一个连续状态的Hopfield联想记忆**更新规则[\[5\]](https://arxiv.org/abs/2008.02217#:~:text=point%20averaging%20over%20all%20patterns%2C,as%20layers%20to%20allow%20the)。也就是说，Transformer注意力可以看作在海量“记忆向量”中进行内容关联检索[\[6\]](https://arxiv.org/abs/2008.02217#:~:text=pattern%20with%20one%20update%2C%20and,as%20layers%20to%20allow%20the)。因此，我们完全可以将注意力看作系统的**内隐记忆检索**模块，并考虑结合显式的外部存储（如向量数据库）提高容量。
3.  **大模型的长程与外部记忆扩展**：为缓解基本Transformer的上下文长度限制，近期出现多种扩展方案：
4.  _Transformer-XL_ 引入循环机制，允许信息在分段之间传递，从而突破固定窗口长度。
5.  _Recurrent Memory Transformer (RMT)_ 在Transformer-XL基础上增加**显式记忆Token**，用于跨segment存储全局信息，可在更长序列上取得比原模型更好的效果[\[7\]](https://arxiv.org/abs/2207.06881#:~:text=complexity%20of%20self,operations%20and%20sequence%20representations%20processing)[\[8\]](https://arxiv.org/abs/2207.06881#:~:text=,as%20algorithmic%20tasks%20and%20reasoning)。这提示我们可以给LLM插入专门的“记忆槽”，存放对话历史或长期知识。
6.  _kNN-LM_ (Khandelwal et al., 2020) 则在训练好的语言模型基础上，引入一个**最近邻检索**机制：对给定上下文，从外部语料库中找到embedding最相近的实例直接提供下文参考。事实证明，这种融合显式记忆的方法可**提升模型对长尾知识的预测能力**，尤其在处理罕见事实时表现突出[\[9\]](https://arxiv.org/abs/1911.00172#:~:text=for%20efficiently%20scaling%20up%20to,modeling%20in%20the%20long%20tail)。简单地说，模型遇到罕见模式（如具体的冷门事实）时，可以查找训练集中类似案例的下一词分布，从而显著降低困惑度[\[10\]](https://arxiv.org/abs/1911.00172#:~:text=%3E%20Abstract%3AWe%20introduce%20%24k%24NN,sets%20and%20allows%20for%20effective)。我们的系统可以借鉴kNN-LM思想，将**向量索引**作为LLM的“旁门记忆”，在回答前检索相似情境下的信息以辅助生成答案。
7.  _RETRO (Retrieval-Enhanced Transformer)_[\[11\]](https://arxiv.org/abs/2112.04426#:~:text=%3E%20Abstract%3AWe%20enhance%20auto,We)和 _Memorizing Transformer_[\[12\]](https://arxiv.org/pdf/2203.08913#:~:text=Published%20as%20a%20conference%20paper,yuhuai)等进一步结合超大规模语料库，训练模型在生成时通过检索数万条相关文档来获得类似3000B参数模型的效果[\[13\]](https://arxiv.org/abs/2112.04426#:~:text=preceding%20tokens,Our%20work%20opens)。例如，DeepMind的RETRO模型利用2万亿标记的外部数据库，插入检索得到的文本片段来提高语言建模性能，在问答等任务上以仅 GPT-3 1/25 参数量达到同等水平[\[11\]](https://arxiv.org/abs/2112.04426#:~:text=%3E%20Abstract%3AWe%20enhance%20auto,We)。这验证了**显式大容量记忆**对小模型有巨大的性能增强作用，提示我们应构建一个可扩展的外部知识库，让AI随时调阅。
8.  _MemGPT_ 是最近的实用框架，旨在让LLM通过自我调用API或读写内存文件来**管理自身的长时记忆**。微软的AutoGen项目中引入了 MemGPT，使LLM能够通过读写自有“记忆池”突破上下文窗口限制[\[14\]](https://microsoft.github.io/autogen/0.2/docs/ecosystem/memgpt/#:~:text=Image%3A%20MemGPT%20Example)。MemGPT允许创建**持续学习**的代理：它可以连接本地文件系统或数据库，随着与用户交互不断更新对用户的了解、甚至**自我人格配置**[\[14\]](https://microsoft.github.io/autogen/0.2/docs/ecosystem/memgpt/#:~:text=Image%3A%20MemGPT%20Example)。这一思路直接启发我们：应设计AI代理自身能调用的记忆读写接口，让模型主动将重要信息“写入脑海”和“读取回想”。
9.  **Agent级的反思、巩固与自我改进**：近期对自治代理的研究（如 Generative Agents、Reflexion）表明，在LLM架构中引入**元认知过程**可以提升持续交互表现。
10. _Generative Agents (Park et al., 2023)_ 模拟了类似《The Sims》中的25个虚拟人，展示出逼真的社会行为[\[15\]](https://arxiv.org/abs/2304.03442#:~:text=interpersonal%20communication%20to%20prototyping%20tools,sandbox%20environment%20inspired%20by%20The)[\[16\]](https://arxiv.org/abs/2304.03442#:~:text=Sims%2C%20where%20end%20users%20can,We%20demonstrate)。其架构扩展了LLM，维护一个全面的**自然语言形式的经验记录**，并不断对累积的记忆进行摘要和反思，从中提炼出更高层次的规划依据[\[17\]](https://arxiv.org/abs/2304.03442#:~:text=conversations%3B%20they%20remember%20and%20reflect,behaviors%3A%20for%20example%2C%20starting%20with)。这些代理会定期回顾当天事件，产生“反思”（reflection）存入记忆，用以指导第二天的行动。工程上，这提示我们可以让AI定期整理当天收集的零散信息，形成**摘要和规律**（如“项目A发布日多次变更，需要特别关注”），存入语义层知识库。
11. _Reflexion (Shinn et al., 2023)_ 则提出了一种让LLM代理通过**语言自我反馈**来改进决策的框架。代理在每次尝试任务后，会**用自然语言总结失败原因或经验**，将这段“反思”存入其短期记忆，下次遇到类似情境时参考，以此在无需权重微调的情况下显著提高成功率[\[18\]](https://arxiv.org/abs/2303.11366#:~:text=methods%20require%20extensive%20training%20samples,making%2C%20coding)。例如，在HumanEval编程任务中，引入自我反思的GPT-4 Agent通过多轮尝试将一次通过率从80%提升到91%[\[19\]](https://arxiv.org/abs/2303.11366#:~:text=%28scalar%20values%20or%20free,and%20analysis%20studies%20using%20different)。这对我们的系统意义重大：我们应让AI在**回答或执行操作后**记录反馈（不管来自用户还是自身判断），更新记忆，从而**逐步自我改进**问答质量和决策策略。
12. _MemGPT_ 在此再次出现：它实际上提供了一种**自我反思-记录-循环**的机制，使LLM像操作系统那样管理内存[\[20\]](https://microsoft.github.io/autogen/0.2/docs/ecosystem/memgpt/#:~:text=MemGPT%20,chatbots%20that%20learn%20about%20you)。通过 MemGPT，一个AI代理可以在每轮对话间隙将新增知识写入外部存储，再在需要时读取，并据此调整后续回答。这与上面的思路一脉相承，也是我们设计**Agent自省模块**的灵感来源。
13. **“做梦”与经验重放在持续学习中的作用**：在人类和强化学习中都有证据表明，离线阶段对记忆进行重放或模拟有助于巩固和泛化。
14. 在机器学习的持续学习领域，_深度生成式重放_ (Deep Generative Replay) 方法[\[21\]](https://arxiv.org/abs/1705.08690#:~:text=the%20problem%2C%20it%20requires%20large,sequential%20learning%20settings%20involving%20image)通过在学习新任务时，让生成模型模拟以前任务的数据来防止灾难性遗忘[\[22\]](https://arxiv.org/abs/1705.08690#:~:text=generative%20nature%20of%20hippocampus%20as,sequential%20learning%20settings%20involving%20image)。简而言之，系统不会简单遗忘旧知识，而是在离线阶段**生成“伪旧样本”与新数据混合训练**，仿佛在“梦中复习”旧知识。我们的系统可采用类似思路，对过去的关键信息进行**生成式重温**——例如利用LLM想象一段涉及旧记忆的新对话，从而强化这些记忆痕迹。
15. 在强化学习中，_Dreamer_ 算法（Hafner et al.）和 _World Models_ (Ha & Schmidhuber) 则让智能体**在内部世界模型中“梦”**。[\[23\]](https://arxiv.org/abs/1803.10122#:~:text=reinforcement%20learning%20environments,at%20%2013%20this%20https)比如World Models中，训练了一个环境生成模型后，智能体可以**完全在梦境中（生成的虚拟轨迹上）学习策略**，再将策略用于真实环境[\[24\]](https://arxiv.org/abs/1803.10122#:~:text=of%20the%20environment,back%20into%20the%20actual%20environment)。Dreamer系列进一步证明，通过在紧凑的潜在空间模拟未来轨迹（latent imagination），能以更高数据效率解决高维视觉任务[\[25\]](https://arxiv.org/abs/1912.01603#:~:text=,efficiency%2C%20computation%20time)。这些成果表明：**离线模拟**对于智能体整合经验、计划未来非常有效。这启发我们可以让AI系统在闲时生成假想场景来**演练**：例如让它假想“如果明天发布会再次推迟，会有哪些后果？”，通过这种“梦境”检查并强化对重要因果关系的理解，同时提早发现潜在问题。

**工程启示**：综上，以上研究为本系统设计提供了关键支撑：我们将实现**双通路的记忆存储**（快速情节记忆 + 慢速语义知识）、**内容可寻址的外部记忆**（结合注意力机制与向量索引）、**大模型+检索混合推理**（让LLM调用知识库），并引入**Agent式的反思与梦境生成**机制，保证系统能持续自我改进。

# 总体架构 🏗️

本节我们将描述系统的总体架构，包括在线工作流程、离线巩固流程、多级内存结构以及各模块的职责分工。我们将通过两张架构图示（Mermaid 图）直观展示系统的数据流，然后对关键组件进行说明。

## 在线工作流程（数据采集→记忆写入→多通道召回→重排→应答）

下面的流程图描述了**在线路径**中系统如何从浏览器获取信息并在需要时提供回答或执行动作：

flowchart TD  
subgraph 浏览器插件（前端）  
A\[内容脚本&lt;br/&gt;采集网页/消息\] -- 提取文本及元数据 --> B\[发送记忆数据&lt;br/&gt;至后端 API\]  
H\[用户请求/询问\] -- 通过长连接或HTTP --> E\[对话/任务代理\]  
end  
subgraph 后端服务  
B --> C(解析与显著性评估&lt;br/&gt;Parser + Scorer)  
C -- 重要信息存储 --> D\[记忆数据库&lt;br/&gt;(情节库+语义库)\]  
D -.-> I\[真值维护器&lt;br/&gt;(监测关键字段变化)\]  
H --> E\[对话/任务代理&lt;br/&gt;(LLM 推理核心)\]  
E --> F{多通道召回&lt;br/&gt;Memory Recall}  
F --> F1\[语义检索&lt;br/&gt;(知识图谱)\]  
F --> F2\[向量检索&lt;br/&gt;(相似情节记忆)\]  
F --> F3\[关键词/BM25 检索&lt;br/&gt;(文本索引)\]  
F --> F4\[时间过滤&lt;br/&gt;(最新/指定时段)\]  
F1 & F2 & F3 & F4 ==> G(候选记忆集合)  
G --> J(重排与过滤&lt;br/&gt;Re-ranker)  
J --> E\[对话/任务代理&lt;br/&gt;整合最终答案\]  
E -- 最终回复/行动 --> X\[响应用户或执行指令\]  
E --> K\[\[在线反思模块\]\]  
K -.更新显著性评分或生成摘要.-> D  
end  
I -- 发现真值冲突 --> N((通知模块))  
X -- 结果展示/通知 --> N((通知模块))

**流程说明**：  
\- **数据采集**：浏览器扩展的内容脚本持续监视用户浏览的网页和收到的聊天消息，根据域名白名单和预设规则提取有用信息（如页面正文、消息文本等），通过插件后台将文本内容和来源元数据发送到后端接口。  
\- **解析与存储**：后端接收到原始文本后，首先由**解析器**清洗内容并分段，然后由**显著性评估器**对各段打分，评估其重要性、新颖性等（算法见后文）。显著性高且有保存价值的内容将由**记忆管理器**写入持久化存储，包括情节记忆库（存原始片段及来源）和语义知识库（抽取出的结构化实体关系）。写入时，若内容涉及关键事实（如日期、数值），真值维护器将介入跟踪其演变。  
\- **用户查询与Agent**：当用户提出问题或需要AI执行任务时（例如在聊天框询问：“项目X最终发布日期是多少？”），请求被发送到后端的**对话/任务代理**。这是以LLM为核心的Agent，它会根据请求调用**多通道召回**模块，从记忆数据库中检索相关信息。  
\- **多通道记忆召回**：召回模块并非单一路径，而是同时采用**四种策略**并行获取候选记忆：1）基于**知识图谱**的语义检索：以查询中的实体为种子，在知识图谱中寻找直接或多跳相关的节点；2）基于向量相似度的语境检索：将查询编码为向量，在情节记忆向量索引中找最近的记忆片段[\[4\]](https://gwern.net/doc/reinforcement-learning/model-free/2016-graves.pdf#:~:text=The%20heads%20use%20three%20distinct,attend%20strongly%20to%20that%20location)；3）基于关键词的模糊搜索：对情节记忆库做关键词或BM25检索，弥补纯向量方式可能的语义鸿沟；4）**时间优先**过滤：根据查询是否要求时序，例如“最近”“某年”等，限定检索范围在对应时间窗口内（或对结果按时间新旧排序）。这些渠道取回各自的一批候选记忆。  
\- **结果融合与重排**：将多个渠道的候选合并后，交由**重排模块**进行相关性排序。重排会综合考虑记忆与查询的语义相关度、时间上的新近性，以及内容多样性，避免重复[\[5\]](https://arxiv.org/abs/2008.02217#:~:text=point%20averaging%20over%20all%20patterns%2C,as%20layers%20to%20allow%20the)。实现上可采用**MMR算法**（最大边际相关）或训练一个Cross-Encoder模型进行评分。重排后得到一组**精选记忆条目**，连同源出处一并返回对话代理。  
\- **生成响应**：对话/任务代理（LLM）将这些检索到的记忆作为上下文，加上必要的提示模板，生成最终回答或决定要执行的动作。因为引入了检索证据，LLM回答时能够**引经据典**，减少幻觉。此外，对于数值/日期等敏感事实，可设计提示要求LLM严格从记忆中抽取而非编造。  
\- **响应与行动**：系统将LLM的回答通过浏览器扩展呈现给用户（如ChatGPT对话框形式），或执行相应操作（如填写网页表单、触发邮件提醒等）。  
\- **在线反思**：在一次交互完成后，代理会触发**在线反思模块**。该模块类似一个快速后台任务，让LLM简要总结本轮问答中**新的收获或待改进点**，如“用户对12/20发布日期的困惑说明我们需要标记它已过期”。这些反思将被发送给记忆管理器：有价值的将存入情节库（作为对该对话的摘要记录），或更新相关记忆条目的显著性（例如被用户查询到的记忆，其重要度可适当提高，详见后文“回忆即强化”机制）。

通过上述在线流程，系统实现了从数据采集、记忆存储到问答决策的闭环，在每次交互中不断丰富和调整自身的“认知”。

## 离线工作流程（批量巩固→梦境重演→规则沉淀→索引更新）

在线流程保证了系统即时响应和即时学习的能力，而**离线流程**则负责周期性地对记忆进行整理、压缩和优化，类似“大脑在睡眠中梳理白天记忆”。下图展示了离线流程的主要阶段：

flowchart LR  
subgraph 定时批处理任务（后端）  
A1\[每日定时触发&lt;br/&gt;批量巩固任务\] --> B1(高频记忆合并整理&lt;br/&gt;Consolidation)  
B1 --> C1{产生摘要&规则&lt;br/&gt;Summarization/Rules}  
B1 --> D1(更新知识图谱/技能库&lt;br/&gt;KG/Skill Update)  
C1 --> D1  
D1 --> E1(重建索引&lt;br/&gt;Re-index Vector/KG)  
E1 --> F1(最新记忆快照)  
A2\[每周定时触发&lt;br/&gt;生成式重放任务\] --> G1(采样高显著记忆&lt;br/&gt;Memory Sampling)  
G1 --> H1(构造梦境场景&lt;br/&gt;LLM Generative Replay)  
H1 --> I1(梦境输出解析入库&lt;br/&gt;Dream Data Ingest)  
I1 --> D1  
end  
subgraph 通知与待确认（前端）  
F1 -.变化检测/真值决议-> X2\[需要用户确认的队列\]  
X2 --> Y2\[浏览器通知/提示用户\]  
Y2 --> Z2\[用户确认反馈&lt;br/&gt;（更新反馈API）\]  
Z2 --> D1

**流程说明**：  
\- **批量巩固 (Consolidation)**：一般在系统闲置的夜间触发（比如每日凌晨）。巩固任务由记忆管理器遍历近期的记忆数据：将**重复出现的内容或主题**进行合并，过滤无用或冗余的信息。例如，一天内多次记录了“会议A的地点在Room 101”，则保留一条提升其频度权重；如果多条记忆围绕同一事件（人物、时间、地点相同），则可以融合成一条更完整的记录。巩固过程中还会计算每个主题的出现频率和时间分布，更新显著性评分中的“频度”因素。  
\- **摘要与规则沉淀**：对高频出现的主题，系统会调用LLM生成**主题摘要**，存入情节库的摘要分区，方便未来快速浏览大量历史。与此同时，结合领域知识模板提取**潜在规则/技能**：例如观察到“每次发布前5天都会开一次全 hands 会”，可以总结为规则存入“技能库”，供代理未来推理时使用（类似于if-then的模式或提示词模版)。  
\- **知识图谱/技能更新**：离线阶段也会将解析出的实体和关系更新到**语义知识图谱**中。比如多条记忆提到“Alice 与 Bob 合作了项目X”，则在KG里确保存在 (Alice)-\[worksWith\]->(Bob) 这样的关系，并为项目X实体关联Alice和Bob为参与者。此外，将新学习的操作流程或决策模式更新到**技能库**（这可以是脚本、DSL规则或Few-shot 提示集），使代理在类似场景下可以直接套用。  
\- **索引重建与优化**：当记忆库经过大量增删合并后，需要重建或增量更新检索索引结构，包括向量索引（FAISS/Annoy 等）和关键词倒排索引，以及KG的关系索引。这样可以移除已删除的冗余向量、纳入新摘要向量，使在线检索保持高效准确。重建索引也包括重新训练/调整**重排模型**（如果使用学习排序器）以适应最新的知识分布。  
\- **生成式重放 (Dreaming)**：每周或按需触发，更低频但更重的批处理任务。系统会**选取显著性最高的若干主题或记忆**（例如最近热度最高的20个事件），用LLM生成“梦境”：具体做法是构造一个包含这些记忆要点的场景或故事prompt，让模型展开生成一个虚构的对话或情景。这种生成内容会包含所选记忆点，但在新的情境中重新组合呈现。生成完毕后，再由解析器提取其中的重要信息，与原始记忆比对。**目的**有二：一是通过这种“模拟使用”，检查记忆是否有不一致或遗漏，并在生成中得到填充（比如模型在故事中推断出两个事件的因果联系，我们据此可以补充知识图谱的关系）；二是**强化学习**：模型生成带有已知事实的内容，相当于对记忆的一次复习重现[\[22\]](https://arxiv.org/abs/1705.08690#:~:text=generative%20nature%20of%20hippocampus%20as,sequential%20learning%20settings%20involving%20image)，我们将生成内容反哺回模型（例如作为fine-tune数据或下次对话的知识），让模型更牢固地掌握这些事实。这有点类似人脑做梦将白天的记忆在脑内重新激活巩固。  
\- **变化检测与用户确认**：巩固和重放过程中，真值维护器会分析**关键数据的最新状态**，例如比较之前记录的“项目发布日期”条目，发现经过多次变化后当前版本与先前版本冲突。对于那些**无法自动确定真伪**或**影响范围较大的变更**，系统不会贸然删除旧记忆，而是将此列入**“待确认队列”**。比如检测到项目X发布日期最终定为12/15，但之前的12/20版本曾用于生成公告，则系统会通知用户：“项目X发布日期曾改为12/20且发送过公告，现已确定为12/15，是否需要撤回或更正旧公告？”。这种通知通过浏览器的通知接口发送，支持用户一键确认或忽略。用户的决策（确认更新/忽略）将通过反馈API传回后端，用于：如果确认，标记旧的相关记忆为废弃或过期，记录用户决策依据（类似TMS的人工介入）；如果忽略，降低此提醒的优先级，避免频繁打扰，并启动计时下次再提醒的机制。

通过离线流程，系统的知识库将更加有序、准确，历史沿革清晰可追溯，同时筛除了杂噪冗余的数据。**在线+离线**两套流程相辅相成：在线侧强调实时响应与即时学习，离线侧负责深度整理与质量提升。

## 内存层次与数据结构

借鉴人类工作记忆-短期记忆-长期记忆的分层模型，我们将系统的记忆划分为多级，并针对不同层级采用不同存储和检索策略：

- **工作记忆**（会话上下文）：对应当前对话或当前浏览页面的临时信息。存储于LLM的上下文窗口中，容量有限但访问速度最快。比如用户最近几句话、本网页DOM提要等，直接随prompt提供给模型。工作记忆不进入长期库，随对话结束而丢弃。
- **短期缓存**（缓存KV / 最近邻索引）：用于保存最近一段时间内高频访问或高显著性的记忆条目，方便快速检索。实现上可以是内存中的一个**LRU缓存**或者内嵌在LLM内部的**kNN记忆模块**。例如最近用户查询过“项目X”，则将项目X的详情embedding及文本缓存，后续相关查询可直接匹配返回。短期缓存的数据也定期同步回长期库（持久层）。
- **情节库**（Episodic Store）：记录各种**原始事件片段**，例如一段对话、一封邮件、一篇网页文章摘要，附带其元数据（来源、时间戳、涉及人物等）。情节库相当于AI的“海马体记忆”，容量大但可能杂乱无章。我们采用**向量数据库**（如 FAISS、Qdrant）索引情节库，使得通过embedding相似度可以匹配相关事件段落。同时每条记录也有显著性分数、标签等，可用于过滤。
- **语义图谱**（Semantic Graph / Knowledge Graph）：存储从情节库中提取的**结构化知识**。包含**实体节点**（人、组织、地点、事件、Artifact、工具等）和**关系边**（例如 likes、worksWith、locatedIn、owns、causes、supersedes 等）。知识图谱是经过整理的“新皮层语义记忆”，支持通过SPARQL或图查询快速获取某实体的关联信息，还能方便地追踪事实的演变（通过特殊关系如 _supersedes_ 表示“被…取代”）。
- **技能库**（Procedural/Rule Memory）：存储的是AI从经验中总结出的**操作步骤、规则和模式**。形式可以是 if-then 规则集、对话策略，甚至是代码脚本。技能库相当于AI大脑中的“基底核”职能，保证遇到特定触发条件时能快速采取行动或填充答案，而不必每次从零思考。技能库的条目主要来源于离线阶段的规则沉淀，也可以由开发者预先植入。一旦某规则被存入技能库，在线阶段代理在判断决策时会优先检查规则匹配，匹配则直接执行，加快响应并减少LLM推理压力。

通过以上层次划分，我们在系统中实现了**既分离又协作**的记忆体系：情节库提供细节和背景，语义库提供抽象关系网，技能库提供直接的行动准则。LLM代理可以灵活调用不同层次的记忆，例如回答事实性问题时查询知识图谱，回忆具体经过时查询情节库，遇到熟悉情境时触发技能库规则。

## 模块组件职责

为实现上述架构，我们划分了若干核心组件，各司其职并通过清晰接口协同：

- **内容解析器 (Parser)**：负责从采集的原始文本中提炼有用信息。包括文章正文提取、HTML清洗、自然段拆分、语言检测、实体识别等预处理。它输出规范化的记忆条目候选。
- **显著性评估器 (Scorer)**：为新记忆条目计算一个综合**显著性分数 S**，衡量其保存价值。Scorer利用内容长度、包含的实体、情感强度、新颖度（与现有记忆差异）等特征计算S，之后详细定义。高于阈值的内容才进入情节库。
- **记忆管理器 (Memory Manager)**：统一管理情节库和知识库的CRUD操作以及索引更新。包括：写入新记忆（情节库）并更新对应的知识图谱实体/关系；合并重复项；删除或标记废弃项（如被确认无效的）。它还负责维护显著性分数，例如“回忆即强化”逻辑在此实现。
- **召回器 (Recaller)**：实现前述多通路检索逻辑。它封装向量数据库查询、图数据库查询、全文搜索等，并对结果进行归并去重。对每次查询请求，召回器返回统一格式的候选记忆列表。
- **重排器 (Ranker)**：对召回器返回的候选进行重相关性排序。可以基于简单加权规则，也可以是一个BERT跨编码器模型对 (query, 文本) 打分。我们的Ranker也会考虑结果多样性，避免内容高度重复的条目全部靠前。
- **真值维护器 (Truth Maintainer)**：监控知识库中特定类型事实（如日期、状态、数值）的更新关系，引入**双时间轴**逻辑记录事实的演变[\[26\]](https://contact-rajeshvinayagam.medium.com/bi-temporal-data-modeling-an-overview-cbba335d1947#:~:text=,was%20recorded%20in%20the%20database)。当有事实被新值 supersede 时，记录其前任->后任关系，以及生效时间和记录时间[\[27\]](https://contact-rajeshvinayagam.medium.com/bi-temporal-data-modeling-an-overview-cbba335d1947#:~:text=database%20en,even%20if%20it%20is%20erroneous)。它通过TMS逻辑确保知识库内部的一致性：若发现矛盾（例如同一项目两个“最终发布日期”标记为final），会标记冲突并通知运维或用户解决[\[28\]](https://medium.com/@rugvedi.ghule20/truth-maintenance-system-28c7c2ef30f7#:~:text=The%20TMS%20works%20by%20keeping,%E2%80%9D)。真值维护器也提供一个**投影视图**接口，可按需要查询“截至某时刻我们认为的事实值”。
- **对话/任务代理 (Agent)**：系统的大脑，基于大型语言模型（可选开源模型本地部署，或API调用）。Agent接受用户的问题或任务请求，然后与记忆系统交互：它通过Recaller获取相关知识，再综合出回答或执行计划。该Agent模块内部可以有简易的**计划-执行循环**（Planner-Executor）：例如用户要求“请把下周的会议安排发我邮件”，Agent会规划步骤（查找下周会议→整理日程→调用邮件发送API）。我们也可以在Agent上叠加一些框架（如LangChain的Tool使用）来扩展其能力。
- **Chrome扩展前端**：包括**内容脚本**（嵌入网页提取内容）和**后台Service Worker**（与后端通信，显示通知，与浏览器交互）。前端根据Manifest V3规范实现最小权限原则，只在配置的网站上启用内容脚本，将捕获的数据摘要后发送，必要时显示后端推送的提醒通知。
- **后端API服务**：提供统一的REST API接口给前端和其它应用模块调用，例如 /ingest(接受新记忆)，/query(查询记忆)，/feedback(用户反馈)。后端包含应用层逻辑和数据库，并实现了异步任务队列用于定时的离线作业。
- **任务调度与队列**：利用消息队列或计划任务（如 cron）实现对离线任务（巩固、重放）的调度。在Microservices架构下，不同服务通过事件总线通信，如 Memory.Upserted 事件触发索引服务更新、Event.Finalized 事件触发通知服务检查等。

各组件通过清晰API衔接，使系统具有良好的模块化和可扩展性。接下来，我们详细定义数据存储模式和算法逻辑。

# 数据与知识建模 🗄️

在系统的数据层，我们需要设计适合**持久存储**记忆和知识的模式，包括情节库（原始记忆片段）、语义知识库（结构化知识），以及事实时间线追踪和真值维护机制。下面分别给出关系数据库模型和图数据库模型的示意，并重点讨论**事件溯源**和**双时间轴**如何结合Truth Maintenance保障数据一致。

## 情节库模式 (Episodic Memory Schema)

情节库记录原始的记忆片段，每条记忆应该至少包含：内容、来源、时间等属性，以及评估得来的附加标签。可以采用关系型表结构，如：

CREATE TABLE EpisodicMemory (  
memory_id BIGINT PRIMARY KEY,  
content TEXT, -- 原文内容或摘要  
source_title VARCHAR(256), -- 内容来源的标题，例如网页标题或邮件主题  
source_url VARCHAR(512), -- 来源链接（若有）  
source_type VARCHAR(50), -- 来源类型，如 "email", "webpage", "chat"  
author VARCHAR(100), -- 作者/发送者（如果适用）  
timestamp DATETIME, -- 内容发生或记录的时间  
sentiment SMALLINT, -- 情绪极性评分 (-100~100)  
surprise_score SMALLINT, -- 意外性/新颖性评分 (-100~100)  
importance SMALLINT, -- 重要性评分 (0~100)  
frequency INT DEFAULT 1, -- 在短期内重复出现的次数  
recency_boost FLOAT DEFAULT 1.0, -- 基于新近性的衰减/加权因子  
salience_score FLOAT, -- 综合显著性分 S  
tags VARCHAR(200), -- 标签列表，如涉及的主题/人物  
related_entities JSON, -- 提取出的相关实体ID列表 (知识图谱中的引用)  
status VARCHAR(20) DEFAULT 'active' -- 状态: active正常, superseded被新信息取代, expired过期等  
);

上述表通过 salience_score 存储显著性分值，通过一系列字段（sentiment, surprise, importance 等）记录用于计算显著性的各要素。related_entities 可用于建立情节记忆与知识图谱实体的关联（例如一段话涉及了项目X和人物Y，则存两个ID）。status 字段用于真值维护（稍后介绍superseded逻辑）。

在实际实现中，情节库可分为若干子表或索引：比如最近N条高显著性记忆单独维护一个热数据表，以加速查询；或者使用ElasticSearch存储全文以便关键词检索。同时，我们会将 EpisodicMemory 中内容的嵌入向量存入向量索引库（如FAISS），以支持向量相似检索。表中 primary key 可选用雪花ID等，以便于分布式场景。

## 语义知识库模式 (Knowledge Graph Schema)

语义库以结构化图谱形式保存实体及其关系。我们可以使用RDF三元组或属性图模型，这里用关系表形式展示一种实现：

CREATE TABLE Entity (  
entity_id BIGINT PRIMARY KEY,  
entity_type VARCHAR(50), -- 实体类型: Person/Org/Project/Event/Tool...  
name VARCHAR(200), -- 实体名称  
description TEXT, -- 描述（可选）  
source VARCHAR(100), -- 实体信息来源，如 "wiki", "user_input"  
created_at DATETIME,  
updated_at DATETIME  
);  
<br/>CREATE TABLE Relation (  
relation_id BIGINT PRIMARY KEY,  
subject_id BIGINT, -- 起点实体  
predicate VARCHAR(50), -- 关系类型, 如 "worksWith","locatedAt","supersedes"  
object_id BIGINT, -- 终点实体  
valid_from DATE, -- 关系有效期（若适用）的开始  
valid_to DATE, -- 关系有效期的结束（可以用 9999-12-31 代表无限远未来）  
confidence FLOAT, -- 置信度/权威度 (0~1)  
source VARCHAR(100), -- 此关系的来源  
created_at DATETIME,  
superseded_by BIGINT NULL -- 如果此关系被新关系取代，则指向新的relation_id  
);

在这个模型中，Entity 表列举所有实体节点，每个实体可以在知识图谱中参与多种关系。Relation 表的每一行代表一条有向关系边，并包含有效时间范围和可信度等信息。例如：Alice 与 Bob 合作一个项目，可以存三元组 (Alice, worksWith, Bob)。若之后Alice改去与Charlie合作，则我们可能增加 (Alice, worksWith, Charlie)，也可以根据需要将前一关系标记过期等。

特别地，这里引入 superseded_by 字段：在发生事实替换时使用。例如某项目的 “发布日期” 关系: (ProjectX, releaseDate, "2023-12-10") 当改期到12月20号时，我们可能插入新关系 (ProjectX, releaseDate, "2023-12-20") 并将旧关系的 superseded_by 指向新记录。这提供了一种**链式追溯**历史的能力，相当于在知识图谱中建立版本关联。

**说明**：上述关系表也可以按predicate拆分为多张表或使用图数据库存储，这里为易读起见简化表示。在图数据库如Neo4j中，我们可能建不同关系类型的Edge，例如 (:Project)-\[:releaseDate {valid_from,...}\]->(:Date) 这样，更直观。但无论实现如何，**核心是通过 supersedes 关系记录知识的演化链**。

## 事件时间线与真值维护 (Temporal Model & TMS)

为了支持系统追踪事实演变，我们采用**事件溯源(Event Sourcing)**的思想，对关键事实采用**追加日志**形式记录，不直接修改原记录[\[29\]](https://martinfowler.com/articles/bitemporal-history.html#:~:text=Bitemporal%20history%20is%20a%20way,reliable%20history%20of%20its%20modifications)。结合**双时间 (Bitemporal)**模型[\[26\]](https://contact-rajeshvinayagam.medium.com/bi-temporal-data-modeling-an-overview-cbba335d1947#:~:text=,was%20recorded%20in%20the%20database)，为每条事实记录赋予两个时间维度：

- **Valid Time（有效时间）**：该信息在现实世界中有效的时间范围。例如某项目发布日期“2023-12-10”有效期也许是从立项时计划一直到后来被修改前。
- **Transaction Time（事务时间）**：该信息被记录/获知并纳入系统的时间。代表系统认知上的历史。通常每条记录有 tx_start（进入知识库时间）和 tx_end（被修改/撤销的时间）。在实现中可用 created_at 和一个类似 superseded_by 指针来推导。

通过双时间，系统能够回答类似问题：“**截至2023年11月1日，我们以为项目发布日期是什么？**” 或 “**实际上2023年12月1日项目发布日期应该是多少？**”。前者用事务时间筛选，后者用有效时间筛选[\[27\]](https://contact-rajeshvinayagam.medium.com/bi-temporal-data-modeling-an-overview-cbba335d1947#:~:text=database%20en,even%20if%20it%20is%20erroneous)[\[30\]](https://contact-rajeshvinayagam.medium.com/bi-temporal-data-modeling-an-overview-cbba335d1947#:~:text=More%20specifically%20the%20temporal%20aspects,valid%20time%20or%20transaction%20time)。例如：项目X发布日期记录的历史：

- 记录1：valid=12月10日，tx_start=8月1日，tx_end=9月30日（在8月~9月期间我们认为发布日期是12/10，但9月30日得知更改了）；
- 记录2：valid=12月5日，tx_start=9月30日，tx_end=10月10日（9月30日获知提前到了12/5，10月10日又推翻）；
- 记录3：valid=12月20日，tx_start=10月10日，tx_end=10月20日；
- 记录4：valid=12月15日，tx_start=10月20日，tx_end= NULL（当前仍有效且标记final）。

采用事件溯源，**我们不会删除旧记录，而是追加新记录，并标记旧记录过期**[\[29\]](https://martinfowler.com/articles/bitemporal-history.html#:~:text=Bitemporal%20history%20is%20a%20way,reliable%20history%20of%20its%20modifications)。比如在关系表中，新增记录4 (releaseDate=12/15)，并把记录3的 superseded_by 指向4。由此，我们能够保留一条完整的链路表示发布日期如何从12/10一路变迁到12/15。

我们可以为关键实体建立专门的历史视图或表，以优化查询。例如SQL中可定义物化视图 ProjectReleaseHistory(project_id, release_date, valid_from, valid_to, tx_start, tx_end, superseded_by) 来展现上述信息。同时，通过**Truth Maintenance System (TMS)**，系统能自动维护这些约束：TMS会在新事实进入时检查是否与当前知识冲突，如果冲突则根据优先级/置信度决定处理（接受新事实则废弃旧事实，或者拒绝新事实并触发人工确认）[\[28\]](https://medium.com/@rugvedi.ghule20/truth-maintenance-system-28c7c2ef30f7#:~:text=The%20TMS%20works%20by%20keeping,%E2%80%9D)。TMS还记录**推理依赖**：如果某结论基于的前提被撤销，则相应结论也标记无效[\[31\]](https://medium.com/@rugvedi.ghule20/truth-maintenance-system-28c7c2ef30f7#:~:text=The%20TMS%20also%20keeps%20track,integrity%20of%20the%20knowledge%20base)。在本系统中，我们利用TMS确保：  
\- 每个项目在某一事务时间上只有一个“最终发布日期”处于有效状态（多版本并存将被视为冲突，需要人工介入）。  
\- 当发布日期变化时，凡是依赖旧发布日期的推论（如“发布会日期=发布日期前一天”这种知识）都将被标记需要复查。系统可以自动调整或通知用户检查这些派生信息。  
\- TMS生成的**冲突列表**提供给通知模块，用于提醒用户。如前述例子，系统会提示关于12/20的先前公告和文档可能需要更新。

综上，数据层的设计保证了知识的**可追溯、可解释**。我们既可以查询任意过去时刻系统的认知状态，又可以基于完整的变更链实现**可解释删除**（例如用户要求“忘掉”某条记录，我们可以将其标记无效但保留痕迹以审计）。

最后，给出一个计算当前真值的例子。考虑上面的 ProjectReleaseHistory：要查询项目X当前的发布日期，可以使用如下逻辑（确定性算法）：

1.  在 Relation 表中找出 subject=项目X, predicate=releaseDate 且没有被 superseded_by 的记录（即当前有效的记录）。
2.  如果有多条，则选择其中 confidence 最高的；若置信度相等则看 tx_start 最新的（最近录入的）[\[32\]](https://contact-rajeshvinayagam.medium.com/bi-temporal-data-modeling-an-overview-cbba335d1947#:~:text=A%20database%20which%20considers%20both,transaction%20time%20and%20valid%20time)。一般由于我们在插入时已经处理冲突，这里应当只有一条。
3.  返回该记录的 object（发布日期值）。

对应SQL查询示例：

SELECT r.object_id AS current_release_date  
FROM Relation r  
LEFT JOIN Relation newer ON newer.superseded_by = r.relation_id  
WHERE r.subject_id = :projectX_id  
AND r.predicate = 'releaseDate'  
AND newer.relation_id IS NULL -- 找到未被取代的记录  
ORDER BY r.confidence DESC, r.tx_start DESC  
LIMIT 1;

这个查询利用了superseded_by为空来筛选当前有效记录，再按置信度和事务时间排序确保取最新最权威的一条。如果我们正确维护了这些关系，那么此查询应准确返回当前的发布日期（如 “2023-12-15”）。这一机制可推广到其它具有演化性质的事实，如人员职位、任务状态等。

# 写入/检索/重排/巩固 – 算法与伪码 🔍

本节从工程细节出发，描述核心算法：显著性评分的计算，多通道记忆召回策略，结果重排方法，以及在线反思、离线巩固和记忆强化等机制的实现方案。伪代码将用于说明关键步骤和参数选择。

## 1\. 显著性评分 S 的计算

我们为每条新产生的记忆计算一个显著性分数 $S$，以决定是否保存以及后续检索排序权重。公式如下：

$$ S = \\alpha \\cdot \\text{重要性} + \\beta \\cdot \\text{频度} + \\gamma \\cdot \\text{新近性} + \\eta \\cdot \\text{意外性} - \\delta \\cdot \\text{冗余度} $$

各项含义与计算方法：

- **重要性**：衡量内容本身的重要程度。可依据启发式规则和模型判别。例如含有用户关心的关键词（项目名称、截止日期）加分，标记为重点事项的内容加分；引用权威来源（如CEO邮件、官方公告）加分；反之琐碎闲聊减分。重要性可以通过预定义词典、NLP模型（如文本摘要中的重点句评分）等得到0~100的分值。
- **频度**：最近一段时间（如过去7天）内**重复出现**该内容或主题的次数。系统维护主题索引，将新内容映射到主题（比如通过embedding聚类或关键词匹配）。出现次数越多，说明这信息可能重要或至少用户经常关注。但也要注意过高频可能意味着重复冗余。我们可以定义频度分=$\\min(5, \\text{近7天出现次数}) \\times 5$，最多给25分，以避免日常打卡等高频无效信息刷高分。
- **新近性**：越新的信息越有时效性。当记忆记录时间距离当前越近，分值越高。可按时间差采用指数衰减或分段线性。例如过去1天内+30分，1~3天+20分，3~7天+10分，一周以上逐渐归零。也可用公式 $ \\text{recency} = e^{-\\lambda \\Delta t} $ 归一化成0~1，再映射到0~N分。这里$\\gamma$调节其权重。
- **意外性**：反映内容出人意料的程度，例如情感极端（非常正面或负面）、罕见事件、与预期不符的事实变化。可以通过情感分析的绝对值、与已有知识的差异计算。如项目延期这种与原计划不符事件可认为意外性高。意外性可以0~100分，根据具体模型输出或规则打分（如情感绝对值80以上+10分，有“重大”“警告”等词汇+10分）。
- **冗余度**：表示这条内容在系统中已存在的程度。如95%以上内容与已有记忆重复，则冗余高，应扣分甚至不存储。通过embedding相似度或指纹(hash)检测重复。如果找到了高度相似的已有记录，则这条S直接降为很低。一般冗余度分值可理解为“需扣除的分数”，完全重复扣掉大量分（甚至筛除）。

默认权重可以经验设定，例如 $\\alpha=0.4, \\beta=0.2, \\gamma=0.2, \\eta=0.2, \\delta=0.5$（可根据实际调整）。这组权重表示重要性占比最高，其次新近性、频度和意外性，冗余度适当大一些以强力淘汰重复信息。我们会针对不同场景A/B测试这些参数，例如选取一组用户日志，用不同参数计算哪些内容被保留，评估质量：

- **A/B测试方案**：选取一些真实使用日志，将$\\alpha,\\beta,\\gamma,\\eta,\\delta$组合在合理范围内取样（比如提升新近性权重 vs 降低等），离线计算系统记忆库内容的覆盖率和用户查询命中率。指标包括：用户后续查询时能否找到需要的信息（召回率）、存储量（冗余率）等。根据这些指标调整权重。也可以采用**贝叶斯优化**方法在模拟环境下寻找最优组合。

在运行过程中，我们也可以动态调整：比如发现系统记忆过载冗余，则提高冗余扣分$\\delta$或抬高阈值；若发现丢掉了有用信息，则降低$\\delta$或增加$\\alpha$等。

## 2\. 多通道记忆召回

召回模块同时利用**向量相似、知识图谱、关键词、时间**等多种策略，以最大程度找到相关记忆。伪代码步骤如下：

function multiModalRecall(query, k):  
entities = NER(query) # 实体识别得到可能的相关实体名  
\# 1. 向量检索  
q_vec = embed(query)  
vec_results = VectorIndex.search(q_vec, top=k\*2) # 取top2k稍多些以备融合  
<br/>\# 2. 知识图谱检索  
kg_results = \[\]  
for e in entities:  
kg_results += KnowledgeGraph.neighborNodes(e, depth=2, limit=k)  
\# 获取查询中涉及实体的1-2跳邻居节点(相关实体)  
<br/>\# 3. 关键词检索（BM25）  
kw_results = TextIndex.search(query, top=k) # 对情节库做关键词匹配  
<br/>\# 4. 按时间过滤（如果query有时间要求）  
time_filtered = \[\]  
timeRange = parseTimeRange(query)  
if timeRange:  
time_filtered = MemoryDB.filterByTime(timeRange, limit=k)  
<br/>\# 合并候选集  
candidates = merge_unique(vec_results, kg_results, kw_results, time_filtered)  
return candidates

上述函数中，我们首先对查询进行基础的NLP处理，如命名实体识别提取出人名、项目名等。然后依次：

- **向量检索**：对查询编码为向量，在向量索引中找最相似的记忆片段。这里我们取$2k$个，以便后续融合时有余量。向量相似找出的通常是**主题相关**或语义相近的段落。
- **知识图谱检索**：利用识别出的实体，从知识图谱中获取其相关实体或事件。通常只取1跳或2跳关系，以保持紧密关联。例如用户问“Alice最近的项目进展”，实体Alice一跳邻居可能有她参与的项目X，二跳邻居可能有项目X的发布日期节点等。我们将这些邻居实体对应的记忆条目找出（例如项目X节点关联的最近一次更新事件）。这样可补充一些**关系推导**出的线索。
- **关键词检索**：对情节库跑BM25或倒排索引搜索含有查询关键词的内容。对于精确匹配一些专有名词、数字等非常有效。而且BM25能找到可能语义上不类似但词汇类似的内容。
- **时间过滤**：如果查询暗示时间范围（例如包含“最近一周”或具体日期），我们直接在情节库中按timestamp筛选，并取相关记录。例如提供一个API MemoryDB.filterByTime(last7days)拿出最近7天内显著性前k的记录。

最后将这些不同来源的结果合并为候选列表，其中要去重——可能同一条记忆被不同渠道找到，只保留一份。可以根据ID或内容哈希做去重。

值得注意的是，多路召回会显著增加候选数，因此**性能**上需要折中。例如向量索引和BM25各取k=10，KG每个实体取几条，合起来可能数十条，这对后续重排是可承受的。如果发现性能瓶颈，可减少KG扩散深度或对大型KG采用基于关系类型的筛选（如只取工作关系，不取社交关系等）。

## 3\. 结果重排算法

合并候选记忆后，我们需要按与当前查询的相关性将其排序，以挑选出最有用的若干条提供给LLM上下文。重排的目标函数考虑**相关性**(Relevance)、**新近性**(Recency)和**多样性**(Diversity)。可采取如下两种实现方案：

- **基于启发式的MMR算法**：MMR(Maximal Marginal Relevance)是一种常用的方法，通过在保证相关性的同时最大化结果间的差异来达到多样性。具体做法：先根据查询相似度对候选排序，然后迭代选择。伪码：  
    
- selected = \[\]  
    λ = 0.7 # 相关性权重  
    while selected.size < N_desired and candidates not empty:  
    for c in candidates:  
    score = λ \* sim(query, c) - (1-λ) \* max_{s in selected} sim(c, s)  
    pick = argmax(score)  
    selected.append(pick)  
    candidates.remove(pick)
- 其中 $sim(query,c)$ 可以用向量余弦相似度或BM25得分，$sim(c_i, c_j)$ 可以用内容embedding的相似度来代表冗余度。通过调节 $\\lambda$ (如0.7) 可以权衡相关 vs 多样。如果已经计算了显著性或时间分，可以把它们加入sim的计算，例如 $sim' = sim + w_{time} \* \\text{freshness}$ 实现**新近性**优先。这样选出的集合既覆盖主要相关点，又不会都是重复内容。
- **基于学习的Cross-Encoder**：训练一个BERT或MiniLM模型，输入\[QUERY\]和\[CAND_TEXT\]对，输出相关性打分。这个模型可以用人工标注的数据（哪个记忆对回答有用）或模拟数据训练。线上使用时，对每个候选计算其得分，然后排序选Top N。为了兼顾时间等因素，可在模型输入中附加这些特征（或提前对候选score加权平均一个时间分）。Cross-Encoder的好处是精度高，能捕捉复杂匹配关系；缺点是对每个候选都要算一次BERT，稍慢。在候选较少（<100）时可以接受。

在我们的设计中，优先实现简单的MMR方案以验证效果，然后视需要替换或微调为Cross-Encoder。排序完成后，会选出例如**前N=10条记忆**作为最终上下文嵌入LLM提示。这N的大小要考虑LLM上下文长度，一般不宜超过模型输入限制或者使总token过大。我们也可以根据显著性对N条截断：保证高显著性条目优先入选。

## 4\. 在线反思与离线巩固

**在线反思**和**离线巩固**分别对应实时自我检查和批量定期学习，两者产出不同，触发条件不同：

- **在线反思 (Reflection)**：在每次用户交互（一次问答或一次代理行动）结束后触发。它运行在后台，不阻塞用户，但会短暂利用LLM整理这次交互。例如生成一小段**对本轮对话的总结**，提取出用户提出的新要求、澄清了哪些事实、有哪些未解决问题等。这个总结将存入情节库，对话历史类别，同时显著性可设高一些方便之后检索最近对话内容。同时，在线反思会检查**代理行为**：如果本轮对话出现了错误回答或用户给了纠正反馈，反思模块应记录“教训”。例如用户纠正了某错误事实，系统会在反思笔记中写明“正确的事实X是什么”并存储或直接更新知识库。Reflexion论文表明，这种**语言层面的自我反馈**能显著提升后续任务表现[\[18\]](https://arxiv.org/abs/2303.11366#:~:text=methods%20require%20extensive%20training%20samples,making%2C%20coding)。我们也会相应地利用这点：把反思结果与原查询关联，使下次遇到类似查询时能优先检索到避免重犯错误。
- **离线巩固 (Consolidation)**：由调度器定时触发（如每天深夜）。其产出较为宏观，包括**主题摘要**和**领域规则**。具体来说：巩固模块聚类最近的记忆条目，找出高频谈论的话题，然后为每个top话题用LLM生成一段摘要，概括主要信息和进展。这些摘要存入知识库中特殊类别节点（Summary），可以在用户很久没问某话题时快速让系统了解“最近都发生了啥”。此外，巩固模块基于长时统计和开发者配置，**抽取规则**：例如“每周五都会发布周报”这种模式，沉淀成一条IF触发->THEN动作的规则，放入技能库。这使得下次周五时系统可以主动提醒用户发送周报。巩固也会**清理旧数据**：对长久未访问且显著性低的记忆，逐渐降低其权重甚至归档出主索引（类似人脑遗忘）。巩固的另一个产出是**索引重建**（上一节已述），保证知识检索的效率和准确性。

## 5\. 生成式重放（梦境模拟）

生成式重放是在离线时段让AI“做梦”，以强化记忆和发现隐含联系的方法。算法流程：

function generativeReplay():  
\# 1. 选择若干高显著性主题  
topics = MemoryDB.getTopTopics(limit=20, time_window=30d)  
for topic in topics:  
related_notes = MemoryDB.queryByTopic(topic, top=5) # 取该主题相关的记忆片段若干  
prompt = composeDreamPrompt(topic, related_notes)  
dream_story = LLM.generate(prompt, max_tokens=500)  
\# 2. 解析梦境输出  
new_facts = Parser.extractFacts(dream_story)  
emotions = Parser.analyzeEmotion(dream_story)  
\# 3. 用梦境内容更新记忆或知识  
for fact in new_facts:  
if not MemoryDB.factExists(fact):  
MemoryDB.insert(fact, source="dream", confidence=0.5)  
MemoryDB.insert({  
content: "\[Dream\] " + dream_story,  
tags: \[topic, "dream"\],  
sentiment: emotions.sentiment,  
surprise_score: emotions.surprise  
})

解释：我们首先选取最近30天内显著性最高的若干主题（如项目X，客户Y等）。对于每个主题，获取一些相关记忆片段（典型代表事件）。然后构造一个prompt，例如：“你是一名回忆录作者，请将关于 \[主题\] 的这些记忆融入一个小故事，故事中尽量体现各记忆点，并发挥想象连接它们。” LLM据此生成一段**融合了真实记忆点的虚构故事**。

生成完毕，我们将故事再交由解析器提取信息：看看故事中是否揭示了某些**新的可能事实或关系**。例如故事情节暗示“因为项目延期，团队士气受挫”，那我们可以从中提炼一个关系：“项目延期” causes “士气降低”。这些推断虽然来自模型虚构，但可能有启发，我们可以赋予低置信度先记录在知识图谱里等待验证（来源标记为“dream”且confidence低）。此外，我们也把整段梦境文本作为一条记忆存储（带特殊标签dream），这样系统在回答开放性问题时甚至可以引用“有个模拟情境中曾发生…”。

**作用**：生成式重放有几点好处：(1) **强化记忆连接**：模型在生成梦境时，需要调动相关记忆点，这本身就是对记忆的再激活，相当于复习了一遍[\[22\]](https://arxiv.org/abs/1705.08690#:~:text=generative%20nature%20of%20hippocampus%20as,sequential%20learning%20settings%20involving%20image)。尤其对于较久未使用的知识，这可以防止它完全淹没。同时，我们在梦境生成后再把内容存入记忆，相当于明示地再次存储了这些信息（以另一种表述），增加冗余度来对抗遗忘。 (2) **发现潜在关系**：模型可能会**自动填充**人类未显式写出的联系，比如梦里它会让两个本来无交集的人物碰面。如果这联系在现实也有可能，我们可以据此拓展知识图谱，为后续验证做准备。 (3) **提高模型稳健性**：通过想象一些极端或未发生的情况并写入记忆，模型在真实遇到类似情况时会更从容，因为在“梦”中见过。例如梦境里模拟了项目再次延期导致连锁问题，那么如果真延期发生，系统可能会提前提醒那些连锁问题。

需要注意生成式重放的**风险**：模型虚构的情节不一定真实，我们必须标注其来源和置信度，避免与真正知识混淆。在查询时也可以不给用户直接呈现梦境（除非用于创意场景），更多是内部消化。通过控制 source="dream" 的使用，我们能将其更多用于内部分析而非直接回答依据。

## 6\. 记忆强化机制 (“回忆即强化”)

人类有“用进废退”的记忆规律，经常回想的事会记得更牢。所以我们在系统中实现“每次回忆命中时，提升记忆权重”的机制：当某条记忆在查询检索中被用到了，我们就认为它对用户是有用且活跃的，应延缓其遗忘速度。具体策略：

- **显著性加分**：如果一条记忆进入了最终LLM答案引用的上下文，则对其 salience_score 增加一个增量 $\\kappa$。$\\kappa$可以按使用频次衰减（比如第一次命中加5分，之后每次加2分封顶），以免某些经常查询的信息分数无限增长。也可以设置一个上限，显著性最高不超过100等。
- **遗忘半衰期重置**：为每条记忆维护一个衰减半衰期（如默认30天不访问则分数减半）。当记忆被访问时，将其下次衰减时间推后。例如某条目上次访问距今20天即将衰减，这次被访问后，我们重置其“未访问计时”，相当于重新强化。可用模型如 $S(t) = S_0 \\cdot e^{-t/T}$，每次命中将 $t$ 清零并适当增加 $T$（延长半衰期）。
- **多次命中权重**：对短时间内被多次查询的记忆，可进一步提高其评分或降低遗忘速率。这和频度因素相关，但频度更多指外部信息重复，这里是用户使用频度。所以我们可以增加一个字段 use_count，每次命中+1，然后每过一段时间衰减。这 use_count 可以作为显著性计算的额外一项因子。

伪代码示例：

function onMemoryRetrieved(memory_id):  
mem = MemoryDB.get(memory_id)  
mem.salience_score += 5 \* (1 / (1 + mem.use_count)) # 初次加5分，次数多则递减增量  
mem.use_count += 1  
mem.last_access = NOW()  
mem.decay_rate \*= 0.9 # 将遗忘速率降低为原来的90%，延缓遗忘  
MemoryDB.update(mem)

如上，第一次使用use_count=0时增5分，之后use_count越高加分越少趋近0，避免无限增高。我们也将记忆的 decay_rate 乘0.9，假设<1表示衰减变慢，即半衰期变长。last_access 时间主要用于后台job定期把长久未访问的记忆降低salience等。

通过“回忆即强化”，系统的知识会形成一个**良性循环**：用户关心的部分在系统中越来越突出，不常用的信息逐渐淡出。这确保系统的注意力分配符合用户实际需求，不会被陈旧、不相关的信息干扰。

# 冲突与更新案例：项目发布日期多次变更 🚦

下面以“项目发布日期多次变更”为例，演示系统从记录事件到维护真值、提示用户的端到端流程。假定项目 **Apollo** 最初计划发布日期为12月10日，后来发生了一系列更改：提前到12月5日、延期到12月20日、最终确定为12月15日。我们看系统如何处理：

1.  **初始记录**：在项目启动时（假设8月1日），情节库收到一条记忆：“Apollo 项目计划发布日期定为 **12月10日**（来源：项目计划书）”。解析器识别出实体 _Apollo项目_、日期 _2023-12-10_，写入情节库。知识图谱中添加实体 Apollo项目（类型Project），以及 (:Project Apollo)-\[:releaseDate\]->(:Date 2023-12-10) 关系，标记 valid_from = 2023-08-01, tx_time = 2023-08-01，confidence=高（因为来源权威）。此时Apollo的当前发布日期=12/10。
2.  **变更提前**：9月30日，收到邮件“由于进度顺利，Apollo 项目发布日期 **提前到12月5日**”。系统解析出Apollo项目发布日期的新值12/5。真值维护器发现Apollo已经有releaseDate=12/10，于是：
3.  在知识图谱Relation表中插入新关系 (Apollo, releaseDate, 12/5) valid_from=2023-09-30，tx_time=2023-09-30。
4.  将旧的12/10那条关系的 superseded_by 指向新记录，并设置它的 tx_end=2023-09-30。标记12/10版本状态为 superseded（被取代）。
5.  触发TMS检查：如有任何之前依赖“12/10发布日期”的推论，现在应更新或标记无效。例如之前生成的项目倒计时提示（10天倒计时）需要重新计算。系统自动调整了内部的Apollo发布倒计时。

由于这次变更被认为是**好消息**（提前），显著性打分中意外性高（因为不常见）且带正面情绪，所以这条记录salience挺高，进入记忆库。

1.  **变更推迟**：10月10日，又来了公告：“Apollo 项目由于某原因，发布日期 **推迟到12月20日**”。系统重复类似流程：插入新关系 (Apollo, releaseDate, 12/20) tx_time=10/10，将12/5记录 superseded_by 指向它。TMS检查发现这和12/5相矛盾，按规则接受新值（因为消息来自项目经理，可信度高），因此12/5标记为过时。然而，由于**12/5曾被宣布**过，TMS会登记一个冲突：之前在9月30日我们通知了市场团队发布日期12/5，现在改为12/20，这可能需要他们调整宣传。于是系统在“待确认队列”加条目：“Apollo发布日期从12/5改到12/20，是否需要通知市场团队修改宣传材料？”（系统不知道要不要通知，因此征询用户）。

此时Apollo的当前发布日期=12/20，历史链：12/10 -> 12/5 -> 12/20。

1.  **最终确定**：10月20日，再次更新：“Apollo 项目最终确认发布日期为 **12月15日**”。系统插入 (Apollo, releaseDate, 12/15)，指向 supersede 之前的12/20版本。由于措辞中有“最终确认”字样，系统将此关系打上 finalized=true 标记，并提高其confidence（因为通常最终确认就是定论）。TMS将12/20版本标记为 superseded，并检测到**重大冲突**：12/20版本可能已经发过正式通知给客户，现在final版是12/15，需要确认如何处理先前通知。系统在“待确认队列”更新条目：“Apollo发布日期先前通知客户为12/20，现提前至12/15。请确认是否发送更正通知给客户。”

系统更新Apollo当前发布日期=12/15，并通过Truth Maintainer提供的视图校准所有相关数据。例如有个项目总工期计算（从开始到发布日期），之前基于12/20，现在将自动更新为基于12/15。

1.  **用户确认与清理**：用户收到浏览器通知，提示上述冲突事项。他在扩展的通知中心看到两条：针对市场宣传和客户通知的建议操作。他可以点击“标记已处理”或者“稍后提醒”。假设用户点了已处理，对客户通知那个，则系统记录用户确认，并调用 POST /feedback 接口，内容包括：{event: "Apollo.ReleaseDateChange", action: "notified_customer"}。后端接收后，会在Apollo项目的知识库节点添加备注：“已通知客户发布日期更新为12/15”。对于市场宣传，他可能点击“稍后提醒”，系统则设置一个24小时后再次提醒的闹钟，同时在记录里留下“user_snooze_count++”。
2.  **历史回放**：若用户或管理员需要，可在前端界面查询Apollo项目的发布日期历史，系统会根据知识库链条生成如下**时间线表**：

| 记录时间 (tx_time) | 发布日期 (valid) | 来源  | 说明  | 状态  |
| --- | --- | --- | --- | --- |
| 2023-08-01 | 2023-12-10 | 计划书 | 项目初始计划 | ❌ 已废弃 (被9/30更新取代) |
| 2023-09-30 | 2023-12-05 | 邮件@PM | 提前发布日期 | ❌ 已废弃 (被10/10更新取代) |
| 2023-10-10 | 2023-12-20 | 公告  | 推迟发布日期 | ❌ 已废弃 (被10/20更新取代) |
| 2023-10-20 | 2023-12-15 | 最终确认通知 | 最终发布日期 | ✔ 生效 (当前有效) |

用户可以点击任一条查看原始记录细节（存储在情节库中的邮件或公告文本），也能看到每条是否有后续**supersede**关系。通过这种可视化，**知识的演变过程一目了然**，满足审计需求。

整个案例体现了本系统对多次变更的信息管理：**不遗漏历史**（可追溯）、**掌握当前真值**（最终值明确）、**辅助用户决策**（冲突提醒与反馈）。这有效避免了传统笔记遗忘更新导致的信息不一致问题。

# Chrome Extension 与后端集成 (MV3) 🖥️

前文描述的功能需要浏览器扩展配合实现数据采集和用户通知。本节说明Chrome扩展（Manifest V3）如何与后端服务集成，并给出关键代码示例。我们遵循MV3约束，采用**Service Worker**作为后台，无持久DOM或长驻内存，所有任务以事件驱动方式进行。

## 扩展权限与Manifest配置

Manifest v3要求在manifest.json中声明扩展所需权限、脚本、规则等。下面是一个最小可行的manifest片段：

{  
"manifest_version": 3,  
"name": "CognitiveMemory Ext",  
"version": "0.1",  
"permissions": \[  
"alarms", // 用于定时触发任务  
"notifications", // 发送系统通知  
"storage" // 存储用户配置和少量缓存  
\],  
"host_permissions": \[  
"\*://\*.example.com/\*",  
"https://projecthub.company.com/\*"  
\],  
"background": {  
"service_worker": "background.js"  
},  
"content_scripts": \[  
{  
"matches": \[  
"https://mail.google.com/\*",  
"https://projecthub.company.com/\*"  
\],  
"js": \["contentScript.js"\],  
"run_at": "document_end"  
}  
\],  
"action": {  
"default_popup": "popup.html"  
}  
}

**说明**：我们申请了 alarms 权限用于周期性任务（如检查提醒队列），notifications 用于显示桌面通知，storage 用于存储用户偏好（如哪些站点启用等）。host_permissions 列出了我们允许内容脚本注入的域，这里包括公司的项目网站、邮箱等。这样遵循**最小权限原则**：未经列出的站点不会注入脚本，保护用户隐私。

content_scripts部分指定了在特定域名的页面加载结束时执行我们的脚本contentScript.js。popup.html则是浏览器工具栏图标点击时弹出的UI（可选，用于显示记忆摘要或配置）。

## 内容脚本：采集与发送

内容脚本运行在网页上下文，负责提取所需信息并发送给后台。一个简单例子：假设我们在company的项目页面想提取项目名称和描述：

// contentScript.js (简化示例)  
(function(){  
// 判断页面是否项目详情页  
const projectNameEl = document.querySelector('h1.project-title');  
const descEl = document.querySelector('div.project-description');  
if(projectNameEl && descEl){  
const data = {  
title: projectNameEl.innerText,  
content: descEl.innerText,  
url: location.href,  
timestamp: new Date().toISOString()  
};  
// 发送消息给背景脚本  
chrome.runtime.sendMessage({type: 'PAGE_CONTENT', payload: data});  
}  
})();

此脚本在匹配的页面加载完毕时执行。它简单检查页面结构，提取需要的文本，然后通过 chrome.runtime.sendMessage 将数据发送给后台Service Worker。不同网站需要定制不同的提取逻辑，可以用CSS选择器、正则等。

对于像邮箱或聊天这种动态加载内容的网站，我们可能需要用 MutationObserver 监听DOM变化，在新邮件展开时抓取内容并发送。Manifest V3不允许直接在content script里持续运行长逻辑，但可以频繁sendMessage，由后台去节流处理。

## 后台Service Worker：通信与任务

background.js作为Service Worker，监听来自content script和长连接的消息，并与后端服务通讯。它的职责：**转发数据、设置定时器、触发通知、缓存配置**等。下面是背景脚本的骨架：

// background.js  
// 1. 监听内容脚本消息  
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {  
if(msg.type === 'PAGE_CONTENT'){  
const data = msg.payload;  
// 对内容进行初步摘要或脱敏  
const snippet = data.content.substring(0, 500);  
// 存储到本地缓存（临时）  
chrome.storage.local.set({ lastCaptured: snippet });  
// 发送到后端 ingest 接口  
fetch('https://your-backend.com/api/ingest', {  
method: 'POST',  
headers: {'Content-Type': 'application/json'},  
body: JSON.stringify(data)  
}).catch(err => console.error('Ingest API error', err));  
}  
});  
<br/>// 2. 定时任务：定期询问后端是否有通知  
chrome.alarms.create('checkNotify', { periodInMinutes: 5 });  
chrome.alarms.onAlarm.addListener(alarm => {  
if(alarm.name === 'checkNotify'){  
fetch('https://your-backend.com/api/notifications')  
.then(r=>r.json()).then(notifs => {  
notifs.forEach(n => {  
// 显示每条通知  
chrome.notifications.create(n.id, {  
type: 'basic',  
iconUrl: 'icons/icon128.png',  
title: n.title,  
message: n.message,  
priority: 2  
});  
});  
});  
}  
});  
<br/>// 3. 用户与通知交互  
chrome.notifications.onClicked.addListener(notificationId => {  
// 用户点击通知，打开相关页面或触发进一步操作  
if(notificationId.startsWith('ApolloRelease')){  
chrome.tabs.create({url: 'https://projecthub.company.com/apollo'});  
}  
// 可以考虑发送确认反馈  
fetch('https://your-backend.com/api/feedback', {  
method: 'POST',  
body: JSON.stringify({notif: notificationId, action: 'clicked'})  
});  
});

**解释**：  
\- 当后台接收到来自内容脚本的页面数据消息时，它先在本地存一份最近捕获内容（以防网络失败可以重试），然后调用后端 /ingest 接口上传数据。这里可以对data做一些压缩、脱敏（如移除敏感字段）再发送。  
\- 我们创建了一个周期闹钟 checkNotify 每5分钟触发，用于轮询后端是否有新的通知（如待确认事项）。实际上也可以让后端通过长连接（webSocket）推送，这里用简单轮询。闹钟触发时，请求后端 /notifications 接口，拿到需要通知的列表，然后使用 chrome.notifications.create 在用户桌面显示通知[\[33\]](https://codelabs.developers.google.com/create-chrome-extension-duetai#:~:text=Codelab%3A%20Build%20a%20Chrome%20Extension,title%3A)。注意manifest里声明了notifications权限才能用。  
\- 监听 chrome.notifications.onClicked 事件，当用户点击某通知时，执行相应动作。例如Apollo发布日期通知，点击则在新tab打开项目页面。并调用后端/feedback接口告知用户查看了通知。还可以监听 onButtonClicked 等，如果我们通知上放了按钮（如“忽略”/“处理”）。

由于MV3后台是service worker，会在闲置时挂起，因此我们不能假设全局有长久状态。定时器和消息监听让我们在需要时启动工作。chrome.storage 用于在挂起间隔持久保存一些小数据，如最后一次捕获的片段、用户配置等。

## 通知与主动确认

前面代码展示了通知创建。在UI上，通知可以带交互按钮，通过 chrome.notifications.create 的options指定。例如可以这样：

chrome.notifications.create('ApolloReleaseChange', {  
type: 'basic',  
iconUrl: 'icons/info.png',  
title: 'Apollo项目发布日期变更',  
message: '发布日期从12/20提前到12/15，是否更新相关文档？',  
buttons: \[  
{title: '标记已更新'},  
{title: '稍后提醒'}  
\]  
});

然后监听 chrome.notifications.onButtonClicked：

chrome.notifications.onButtonClicked.addListener((notifId, btnIndex) => {  
if(notifId === 'ApolloReleaseChange'){  
let action = (btnIndex === 0) ? 'confirmed' : 'snooze';  
fetch('https://your-backend.com/api/feedback', {  
method: 'POST',  
body: JSON.stringify({event: 'Apollo.ReleaseDateChange', action: action})  
});  
if(btnIndex === 0){  
chrome.notifications.clear(notifId);  
} else {  
// 稍后提醒：这里简单地再设一个闹钟比如10分钟后  
chrome.alarms.create('remind_ApolloRelease', {delayInMinutes: 10});  
}  
}  
});

通过这种方式，用户可以直接在通知上选择操作，前端捕获后发送到后端。**MV3要求**通知交互必须在按钮上，没有直接文本输入，所以确认类操作一般用按钮即可完成。

## 隐私与安全考虑

扩展只采集**必要的信息**且**用户可配置**。我们在manifest中硬编码了特定域名，以避免注入所有网站。同时，在content script中也可增加判断，如页面url路径必须匹配某模式才提取，进一步减少不相关数据的采集。对采集到的数据，我们采取**本地摘要和脱敏**：如不需要全文则截取一部分，不上传用户私人标识（如用户名、邮件地址）等。可以利用 chrome.storage 或直接在content script中剔除敏感字段。

数据传输到后端应使用HTTPS，并考虑端到端加密策略对敏感数据（二次加密字段存储）。扩展本地保存的任何缓存也应该在用户退出时清理，以防被他人读取。

## 最小可行示例代码骨架

综合以上，扩展侧的代码主要包括：

- manifest.json（如前所示）
- contentScript.js（针对每个目标站点定制的提取逻辑）
- background.js（接收消息->调用后端API，定时poll->通知显示，通知点击->反馈）
- popup.html + popup.js（可选，用于用户查看近期记忆、设置偏好等UI）

一个简单的contentScript/backgound对的交互如上例所示，已经能完成采集->上传->通知的大致流程。开发者可以以此为基础逐步完善，如增加错误重试、队列等机制。

最后，**Manifest V3限制**背景不能长时间运行，比如我们不能用setTimeout长延时，因此采用 chrome.alarms 实现定时。这保证了即使SW挂起，到了时间也会唤醒执行。我们也避免使用任何 eval、远程代码等MV3不允许的操作。所有外部通信都通过fetch，并在host_permissions控制的域名范围内，确保合规。

# 后端与调度 ⏱️

后端采用**API服务**为核心架构，同时借助消息队列实现解耦和异步处理。前端（浏览器扩展）与后端主要通过REST API通信，而后端内部各子模块通过发布/订阅事件总线协作。下面定义主要API以及事件约定。

## API 接口设计 (OpenAPI 3.0)

我们规划的后端API如下：

- POST /ingest：接收新记忆数据。例如浏览器采集到一段文本，就通过此接口上传。请求体JSON可能包含：content 文本, source 来源, timestamp 时间等字段。服务器处理后返回状态（成功则200）。
- GET /memory/query：供Agent或前端查询记忆库。支持参数：q（查询语句或embedding向量），mode（检索模式：vec/kg/keyword/all），以及分页选项。返回相关记忆条目列表以及引用标识。
- POST /feedback：接收用户反馈或交互结果。包括但不限于：用户确认了某通知，忽略了某建议，或者用户纠正了某回答中的错误。这些反馈用于训练Reflexion或更新知识库。
- POST /consolidate：用于触发离线巩固任务。如每日定时job hitting此endpoint开始执行巩固流程。也可以做成内部不公开的接口，仅供后端自己调用。
- POST /notify：后端通知前端的接口（如果采用push模式而非轮询）。浏览器扩展可以长连接订阅或者定期poll /notifications GET接口。这里也列出POST /notify，假设某些情况下后端主动推送。

以下是一个简化的OpenAPI 3.0定義示例（YAML 格式）：

openapi: "3.0.0"  
info:  
title: Cognitive Memory API  
version: "1.0"  
paths:  
/ingest:  
post:  
summary: Ingest new memory item  
requestBody:  
required: true  
content:  
application/json:  
schema:  
$ref: "#/components/schemas/MemoryItem"  
responses:  
"200":  
description: Ingested  
/memory/query:  
get:  
summary: Query memory store  
parameters:  
\- name: q  
in: query  
schema: { type: string }  
description: Query string or keywords  
\- name: mode  
in: query  
schema: { type: string, enum: \[all, vector, keyword, kg\] }  
default: all  
\- name: limit  
in: query  
schema: { type: integer, default: 10 }  
responses:  
"200":  
description: Query results  
content:  
application/json:  
schema:  
type: object  
properties:  
results:  
type: array  
items: { $ref: "#/components/schemas/MemoryItem" }  
/feedback:  
post:  
summary: Send user feedback or confirmation  
requestBody:  
content:  
application/json:  
schema:  
type: object  
properties:  
event: { type: string }  
action: { type: string }  
detail: { type: string }  
responses:  
"200": { description: Feedback noted }  
components:  
schemas:  
MemoryItem:  
type: object  
properties:  
id: { type: string }  
content: { type: string }  
source: { type: string }  
timestamp: { type: string, format: date-time }  
tags: { type: array, items: { type: string } }  
salience: { type: number }

_(示例中省略了一些细节，如认证、安全等)_

通过这样的API定义，前后端都有清晰契约。同时这也便于后端团队独立实现和测试这些接口。

## 消息总线与事件规范

在后端内部以及与其他系统交互时，我们使用消息事件来解耦。例如当一条新记忆写入后，希望索引服务自动更新向量库，就可以通过事件来实现。以下是约定的一些事件类型：

- **Memory.Upserted**：在情节库中新插入或更新记忆时发出，包含内容ID、标签等。订阅者：向量索引服务（更新embedding索引）、知识图谱服务（更新相关实体出现频次）等。
- **Event.Finalized**：某事件的最终状态确定时触发，例如发布日确定。订阅者：通知服务（准备发送用户提示）、订阅该事件的其他系统（如项目管理系统）。
- **User.Confirmed**：用户通过通知UI确认了某操作，例如确认发布日期变更已经处理。订阅者：知识库/TMS（将冲突标记resolved），日志系统（记录用户决策）。
- **Agent.Feedback**：Agent在对话后产生了反思内容时发布，包含反思文本、相关主题等。订阅者：记忆管理模块（写入情节库）、规则引擎（尝试抽取规则）。
- **Schedule.Due**：定时任务触发事件。例如每周生成式重放到点时发送Schedule.Due{task: "generativeReplay"}，由Memory Manager接收后执行重放流程。

消息总线可使用诸如RabbitMQ、Kafka等，在配置中心定义topic/路由规则。例如Memory.Upserted和Event.Finalized可能走同一“Knowledge”主题队列不同key，以供知识库服务筛选处理。

事件消息通常为JSON，包含必要字段。如Memory.Upserted会提供：{id:123, type:"email", tags:\["Project:Apollo"\], salience:80} 以供订阅方判断如何处理。

通过事件驱动，我们确保了后端模块的**松耦合**和**扩展性**：日后增加一个“邮件提醒服务”订阅Event.Finalized即可实现自动发邮件通知客户，无需改动核心逻辑。

# 评测与监控 📊

为了验证系统效果并持续改进，我们将制定一系列评测指标和实验方案，同时在实际部署中监控关键数据。以下是主要的评测维度：

- **检索@k 命中率**：针对用户提问，我们检查在返回给LLM的前k条记忆中，有多少包含正确答案依据。例如@5命中率表示正确所需信息在召回的前5条中出现的比例。这个指标反映记忆检索的有效性。我们会使用一批测试问答对（ground truth已知答案出处）来计算。例如100个问题，看检索模块前5结果里有无包含答案句子。理想情况下这个值要高于90%。
- **证据引用率**：LLM最终生成回答时**引用记忆来源**的情况。例如回答包含了 “【来源】” 引用片段的比例。高证据引用率意味着AI在利用记忆库而非胡乱生成。我们甚至可以细分为**正确引用率**（引用的是正确出处）和**错误引用**（引用不相关记忆）比例。希望正确引用率高、错误引用极低。
- **时间线正确率**：对于有演变的知识，系统提供**当前真值**的准确性，以及能否正确描述历史。我们可设计测试，比如给系统一系列事件更新，然后询问“现在X是什么？以前呢？”，看系统回答是否符合期望。在Apollo案例中，期望回答当前发布日期12/15且能列出之前几个日期。这个可人工评估或单元测试基于knowledge base状态。
- **通知点击率与满意度**：系统发出的主动通知中，用户实际点击查看或操作的比例，以及用户反馈这些通知是否有用。我们可记录每类通知发送次数和点击次数，计算点击率。如发布变更通知发送10次有8次被点击，则80%点击率，说明相关性强。若某类通知长期点击率低于10%，可能就是骚扰无用信息，应调整触发策略。另外可以在通知UI让用户给个反馈（比如“这是有用的”/“不再提示此类”），统计满意度。
- **长期遗忘曲线**：监控记忆库中文件的“遗忘”情况。比如一个知识点X，3个月后用户再问起还能不能从库里找到。我们可以离线模拟一些知识随着时间衰减被系统淡忘的过程，检查调参后在多长时间里还能保有多大比例知识。类似科学的记忆遗忘曲线实验：对某批知识不再提及，让系统间隔一周、一月、一季问答，看回答准确率随时间的下降。这可以验证我们的记忆强化和巩固机制效果，希望曲线下降缓慢而平滑。

除了上述指标，我们将搭建**仪表盘**监控运行数据：例如每日新增记忆量、检索平均延迟、LLM调用次数、用户交互次数等，以便及时发现异常（如某天记忆暴增可能采集脚本失控）。

## 对照实验设计

我们计划在内测阶段进行多组对照实验（A/B测试），以量化各模块对性能的提升：

- **Baseline vs 各增强模块**：将用户随机分成几组，分别使用不同配置：
- A组（基线）：仅启用**向量记忆检索**，无KG联想、无反思、无重放。
- B组：启用**向量 + 知识图谱检索**，比较是否回答准确率提升。
- C组：在B基础上加入**显著性权重和重排**，看是否进一步提升相关性和减少幻觉。
- D组：再加入**Agent反思和离线重放**，观察长周期（例如2周）后，模型性能随时间的变化，相比不使用反思的组是否知识保留率更高。

评价这些组可使用前述指标：例如检索@5命中率、回答正确率（人工评估QA正确性）、用户满意度评分等。我们预计，逐步加入模块会提高性能：B > A、C > B、D > C。如果发现某组效果不如前，比如发现知识图谱反而引入噪音降低了准确率，则需分析原因（可能KG质量问题）并改进。

- **样本规模估计**：为了检测显著差异，我们需要足够的实验样本。假设我们希望检测到回答正确率5%的提升，采用95%置信水平、80%检验力，经粗略计算每组需要数百次问答交互数据。如果每位测试用户平均每天提5问，则100用户一周约3500问答，应该能满足比较需求。因此内测阶段每组至少100人，或根据可用用户数量调整周期来积累足够数据。

实验过程中我们会收集定性反馈，例如测试用户是否注意到回答质量提升、通知是否有帮助等。综合量化和质化结果，为最终系统调优提供依据。

# 安全、合规与边界 🔒

设计人脑式记忆系统时，必须高度重视用户数据的安全和隐私，以及系统行为的可控性。我们采取多层措施来确保合规可靠：

- **敏感数据分类与加密**：系统对采集的信息进行敏感度分类。比如个人身份、财务数据标记为高敏感。这类数据将**只在本地或用户私有云存储**，并在存储层使用强加密（如AES-256）保存，只有用户持有的密钥才能解密查看。传输过程中也全程TLS加密。此外，实现“点删”功能：用户可以要求删除某段时间或某人物相关的所有记忆，我们将根据实体标签和时间戳准确筛出并删除，加密的数据立即销毁密钥确保无法恢复。
- **可解释的删除与审计**：每当系统自动更新或删除记忆时，都记录原因和触发来源（哪条新信息导致）。例如“发布日期12/10被12/5取代，因为收到9/30邮件”。这些记录组成审计日志，使管理员或用户日后可以追溯为什么某信息不见了。用户也可以查看自己的“数字足迹”：系统保存了哪些他们的数据、源自哪。我们提供导出工具，一键导出或一键删除（遗忘）指定主体的数据，满足GDPR等法规要求。
- **浏览器端最小权限**：扩展只在**经过用户同意**的域名上启用采集，而且默认采集的是**文本摘要**而非逐字全文。如有需要全文（比如合同文本分析），也会明确提示用户。扩展无权访问文件系统、剪贴板等除非必要且征求许可。通过declarativeNetRequest等机制，我们可以进一步限制扩展只能将数据发往我们的后端，防止恶意中间人。代码开源或经过第三方审核也将提升用户信任度。
- **滥用控制**：系统有可能被用来过度打扰用户或输出错误信息，我们需加防护。首先在**通知节流**上，每类主题24小时内最多主动通知一次，防止通知轰炸用户。如前所述我们也跟踪通知点击率：若用户多次忽略某主题的通知，则自动进入“勿扰”模式，降低此主题后续提醒频率。其次在**可信度门限**上，系统对于置信度不高的信息不会轻易动作。例如某条未经确认的传闻，不会自动发通知给多人，除非得到权威消息证实或用户手动确认。
- **LLM能力边界**：我们清醒地认识到纯LLM有局限。它擅长语言关联，但不保证事实准确，尤其断网或检索失败时可能胡编。为此我们设定fallback策略：
- 当检索系统返回结果为空或低置信时，LLM代理应**明确告知无法找到相关记忆**，而不是编造答案。比如回复“抱歉，我没有这方面的信息”。
- 对于数值、日期等关键字段回答，要求LLM必须**有出处引用**才予输出，否则宁可不猜。这在提示模板中硬约束。例如“若无法确定，请回答‘我不确定’”。
- 在离线模式（假设后端检索不可用）下，系统只会提供有限功能，如只能回答通用问题而不涉及时效信息，并提示用户连接网络以获得完整功能。
- 我们也考虑在LLM输出后增加**校验**：比如用规则或小模型检查回答中的事实是否存在于记忆。如果出现未确认的断言，则标记回答不可靠要求LLM重试或标示警告。

通过以上措施，我们在提供强大记忆功能的同时，尽量保证对用户友好、安全和可控。系统不会任意收集无关数据，不会在不确定时贸然给出可能误导的答案，且所有操作都有迹可循。我们也会定期安全评估，包括渗透测试、权限审计，及时修补漏洞，确保系统满足企业合规要求。

# 里程碑计划与人力配置 ⏱️👥

为了高效推进项目落地，我们制定如下里程碑和团队安排，并识别关键风险与对应缓解措施。

**P0 - 核心功能验证 (4周)**  
\- **里程碑目标**：搭建基本的记忆系统框架，实现数据采集、简单检索以及LLM问答集成。在小范围内证明系统可用。  
\- **主要任务**：  
\- 后端：搭建数据存储（情节库+简单关系表）、实现 /ingest 和 /query API、集成向量数据库（例如配置Milvus/Qdrant）以支持embedding检索。  
\- 前端：开发Chrome扩展基础功能，在指定测试网页上采集文本并发送至后端；实现简单通知显示。  
\- LLM代理：选定并集成LLM（初期可用OpenAI API），编写Prompt模板使其利用检索结果回答。  
\- 测试：选取若干测试场景人工验证，如读取一篇项目报告后问相关问题，检查是否引用报告内容回答。  
\- **人力配置**：3人小团队即可完成：1名后端工程师负责API和数据库，1名前端工程师负责浏览器扩展，1名算法工程师负责向量检索和LLM集成。团队协作下，每周Demo进展给stakeholder看。

**P1 - 功能扩展与优化 (4~6周)**  
\- **里程碑目标**：引入知识图谱、真值维护、反思/巩固等高级功能。在中等规模数据和用户下验证性能。  
\- **主要任务**：  
\- 知识图谱：设计图数据库模式，开发实体抽取和关系更新模块，将现有记忆转化为KG节点。实现 /memory/query 的KG检索部分。  
\- 真值维护：实现supersede逻辑和双时间字段，重点针对2-3类关键实体（如项目日期、人事变动）试运行TMS规则。  
\- 反思与巩固：实现Agent在线反思，将反馈写入记忆；调度每日巩固任务，生成摘要和规则。  
\- 重排优化：实现MMR或训练一个Cross-Encoder，用真实数据调参提升排序质量。  
\- 前端优化：丰富content script规则，覆盖更多测试站点；在popup页面提供简单界面展示记忆列表，方便用户查看/删除个人数据。  
\- 测试与调整：扩大测试用户至20-30人，让他们日常使用一段时间。通过日志分析调优显著性系数、通知频率等。  
\- **人力配置**：需要更广泛技能，团队扩充到5-6人：新增1名NLP工程师负责知识抽取与KG构建，1名数据工程师负责定时任务和数据管道，QA测试人员1名。原有成员继续各自模块开发并相互配合。

**P2 - 上线准备与硬化 (4周)**  
\- **里程碑目标**：性能、安全优化，准备在更大用户群上线试运行。  
\- **主要任务**：  
\- 性能扩展：针对数十万级记忆数据优化数据库索引，考虑缓存机制。压测高并发下检索延迟，进行必要的查询优化和分片。  
\- 安全检查：代码安全审计，第三方依赖升级检查。完善加密和权限策略，编写隐私政策文档。  
\- 边界情况处理：模拟各种异常场景（如后端某服务挂掉、网络断连、用户提出无理要求等），确保系统有合理fallback。  
\- 用户培训与文档：撰写用户指南，解释系统如何使用和配置隐私设置。对于企业内推广，准备宣讲材料。  
\- 小规模试上线：选择50-100人试用一周，重点监控系统稳定性和资源占用。收集反馈bug，进行最后修复。  
\- **人力配置**：进入收尾阶段，需要DevOps工程师1名协助部署和监控。整体团队约6-7人在最后冲刺。每周召开风险评估会议，确保无重大遗留问题。

**关键风险清单与缓解**：  
\- 风险1：**隐私数据泄露风险**。缓解：严格域名白名单，不采集敏感字段；全程加密传输存储；提供用户数据查看与删除功能。定期安全测试。  
\- 风险2：**LLM幻觉导致错误决策**。缓解：强化检索引用机制，未检索到信息时避免臆断；对关键回答增加rule-based校验；必要时引入用户二次确认。  
\- 风险3：**系统误通知打扰用户**。缓解：设定通知阈值策略【F)建议】（显著性高且关联用户关注主题才通知），以及“同主题24h最多一次”限制；用户可配置免打扰时段。  
\- 风险4：**性能瓶颈**（检索慢或扩展影响浏览器速度）。缓解：在客户端对采集频率限流（如DOM变化短时间频繁则合并后发送）；后端采用异步队列避免阻塞；对向量检索和KG查询添加缓存。扩展脚本尽量轻量，不阻塞页面主线程。  
\- 风险5：**开发延误或复杂度超出**。我们的设计较前沿复杂，可能遇到实现难点。缓解：采用迭代开发策略，P0只做基础，P1/P2逐步加功能；必要时缩减次要功能优先保证核心模块可用；寻求开源项目借鉴（如LangChain、Haystack）。

通过里程碑推进和对风险的预先防范，我们有信心在计划周期内构建出可用的系统并平稳过渡到生产使用。团队各成员职责清晰，既有并行开发又有定期同步，从而最大化效率和质量。

下面我们提供**“快速落地清单”**，作为本周启动开发的指导：

# 快速落地清单 ✅

1.  **环境搭建**：
2.  创建后端项目框架（选择Python Flask/FastAPI 或 Node.js Express 等），初始化 /ingest, /query 等基本路由。
3.  准备向量数据库（如安装Milvus或直接用Faiss in-memory），准备基础SQL/NoSQL数据库用于情节库和知识库。
4.  确认一个可用的大语言模型（API key或者本地模型权重），写一个简单函数调用它。
5.  **浏览器扩展初始化**：
6.  使用 chrome-extension CLI 或手动创建 manifest.json（MV3），声明基本权限（alarms, notifications, storage）和背景/内容脚本。
7.  编写一个简单 content script，在一个测试网页（例如 company项目主页）抓取标题和一段文本，并通过 chrome.runtime.sendMessage 发给后台。
8.  编写 background.js，监听消息后将数据 fetch 到后端 /ingest。
9.  在Chrome中加载未打包扩展，调试确保 content script -> background -> 后端链路打通（可在后端log看到收到的数据）。
10. **基础记忆存储&检索**：
11. 实现 /ingest API 将收到的数据存入数据库的 EpisodicMemory 表（或临时用内存数组），同时计算简单显著性S（先设定固定值或规则）。
12. 选用句向量模型（如SBERT），对content生成embedding，存入向量索引。
13. 实现 /memory/query API：接受查询字符串，用embedding检索top5相似内容，返回给前端或LLM模块。
14. 本地测试：手动调用 /ingest 插入几条记忆，然后调用 /query?q="..." 检查能否检索出相关内容。调整embedding或分词效果。
15. **LLM Agent集成**：
16. 在后端实现一个 /ask 接口（供前端调用或暂时postman调试），逻辑：接收用户问题 -> 调用上述 recall 获取记忆列表 -> 将问题+记忆一起组装prompt -> 调用LLM生成答案 -> 返回答案。
17. 简单Prompt模板例如: "用户提问: {question}\\n相关资料:\\n1.{mem1}\\n2.{mem2}\\n请根据资料回答:"。
18. 用已插入的测试记忆验证LLM回答是否引用了资料内容。必要时在prompt末尾加要求引用格式。
19. **验证关键场景**：
20. 模拟“项目发布日期变更”场景：手动 /ingest 三条不同日期的记录，然后 /query 看能否得到最新的。暂时先不实现TMS，用人工检查代替。
21. 模拟通知：手动调用 Chrome 扩展 background 的 chrome.notifications 创建，观察弹出。
22. 模拟反馈：在扩展内写死一个 onClicked 直接调用后端 /feedback，后端简单打印日志。测试点击通知是否触发。
23. **迭代完善**：
24. 在基本跑通后，开始实现显著性评分函数，用简单规则给不同字段赋分。
25. 增强 content script 适配更多页面（如公司的Wiki/工单系统等），扩大采集范围。
26. 为知识库创建基本的 Entity/Relation 表结构，在 ingest 时识别简单的实体关系存进去。
27. 定时任务：用 chrome.alarms 实现每分钟/每小时的定时Ping，现阶段让它调用一个后端接口（可以返回伪造的通知数据）以测试前端通知机制。
28. **团队协作**：
29. 前端开发专注 Manifest配置、content script提取、消息通信；
30. 后端开发专注 API、数据库交互；
31. 算法工程师调优embedding和检索。
32. 每日短会同步进展，发现接口对接问题及时解决。
33. **风险意识**：
34. 开发过程中注意不要commit敏感API密钥，使用环境变量管理。
35. 扩展脚本初期不要注入敏感站点（如银行网页），避免潜在法律风险。
36. 若遇到LLM不稳定，先用简单规则mock回答，保证流程可测。LLM可以稍后替换接入。

按照以上清单逐步执行，本周内我们应当能够搭建起一个基本可运行的“记忆+问答”雏形。在此基础上，再根据详细方案逐步添加复杂功能。这样敏捷迭代，尽早发现问题、验证思路，确保项目朝着预期方向发展。

[\[1\]](https://pubmed.ncbi.nlm.nih.gov/17696170/#:~:text=of%20episodic%20memory%20based%20on,thus%20retrieve%20the%20memory%20of) The hippocampal indexing theory and episodic memory: updating the index - PubMed

https://pubmed.ncbi.nlm.nih.gov/17696170/

[\[2\]](https://pubmed.ncbi.nlm.nih.gov/22141588/#:~:text=This%20paper%20reviews%20the%20fate,including%20the%20following%3A%20the%20basic) Complementary learning systems - PubMed

https://pubmed.ncbi.nlm.nih.gov/22141588/

[\[3\]](https://gwern.net/doc/reinforcement-learning/model-free/2016-graves.pdf#:~:text=without%20interference10%2C11,to%20an%20external%20memory%20matrix) [\[4\]](https://gwern.net/doc/reinforcement-learning/model-free/2016-graves.pdf#:~:text=The%20heads%20use%20three%20distinct,attend%20strongly%20to%20that%20location) Hybrid computing using a neural network with dynamic external memory

https://gwern.net/doc/reinforcement-learning/model-free/2016-graves.pdf

[\[5\]](https://arxiv.org/abs/2008.02217#:~:text=point%20averaging%20over%20all%20patterns%2C,as%20layers%20to%20allow%20the) [\[6\]](https://arxiv.org/abs/2008.02217#:~:text=pattern%20with%20one%20update%2C%20and,as%20layers%20to%20allow%20the) \[2008.02217\] Hopfield Networks is All You Need

https://arxiv.org/abs/2008.02217

[\[7\]](https://arxiv.org/abs/2207.06881#:~:text=complexity%20of%20self,operations%20and%20sequence%20representations%20processing) [\[8\]](https://arxiv.org/abs/2207.06881#:~:text=,as%20algorithmic%20tasks%20and%20reasoning) \[2207.06881\] Recurrent Memory Transformer

https://arxiv.org/abs/2207.06881

[\[9\]](https://arxiv.org/abs/1911.00172#:~:text=for%20efficiently%20scaling%20up%20to,modeling%20in%20the%20long%20tail) [\[10\]](https://arxiv.org/abs/1911.00172#:~:text=%3E%20Abstract%3AWe%20introduce%20%24k%24NN,sets%20and%20allows%20for%20effective) \[1911.00172\] Generalization through Memorization: Nearest Neighbor Language Models

https://arxiv.org/abs/1911.00172

[\[11\]](https://arxiv.org/abs/2112.04426#:~:text=%3E%20Abstract%3AWe%20enhance%20auto,We) [\[13\]](https://arxiv.org/abs/2112.04426#:~:text=preceding%20tokens,Our%20work%20opens) \[2112.04426\] Improving language models by retrieving from trillions of tokens

https://arxiv.org/abs/2112.04426

[\[12\]](https://arxiv.org/pdf/2203.08913#:~:text=Published%20as%20a%20conference%20paper,yuhuai) \[PDF\] Memorizing Transformer - arXiv

https://arxiv.org/pdf/2203.08913

[\[14\]](https://microsoft.github.io/autogen/0.2/docs/ecosystem/memgpt/#:~:text=Image%3A%20MemGPT%20Example) [\[20\]](https://microsoft.github.io/autogen/0.2/docs/ecosystem/memgpt/#:~:text=MemGPT%20,chatbots%20that%20learn%20about%20you) MemGPT | AutoGen 0.2

https://microsoft.github.io/autogen/0.2/docs/ecosystem/memgpt/

[\[15\]](https://arxiv.org/abs/2304.03442#:~:text=interpersonal%20communication%20to%20prototyping%20tools,sandbox%20environment%20inspired%20by%20The) [\[16\]](https://arxiv.org/abs/2304.03442#:~:text=Sims%2C%20where%20end%20users%20can,We%20demonstrate) [\[17\]](https://arxiv.org/abs/2304.03442#:~:text=conversations%3B%20they%20remember%20and%20reflect,behaviors%3A%20for%20example%2C%20starting%20with) \[2304.03442\] Generative Agents: Interactive Simulacra of Human Behavior

https://arxiv.org/abs/2304.03442

[\[18\]](https://arxiv.org/abs/2303.11366#:~:text=methods%20require%20extensive%20training%20samples,making%2C%20coding) [\[19\]](https://arxiv.org/abs/2303.11366#:~:text=%28scalar%20values%20or%20free,and%20analysis%20studies%20using%20different) \[2303.11366\] Reflexion: Language Agents with Verbal Reinforcement Learning

https://arxiv.org/abs/2303.11366

[\[21\]](https://arxiv.org/abs/1705.08690#:~:text=the%20problem%2C%20it%20requires%20large,sequential%20learning%20settings%20involving%20image) [\[22\]](https://arxiv.org/abs/1705.08690#:~:text=generative%20nature%20of%20hippocampus%20as,sequential%20learning%20settings%20involving%20image) \[1705.08690\] Continual Learning with Deep Generative Replay

https://arxiv.org/abs/1705.08690

[\[23\]](https://arxiv.org/abs/1803.10122#:~:text=reinforcement%20learning%20environments,at%20%2013%20this%20https) [\[24\]](https://arxiv.org/abs/1803.10122#:~:text=of%20the%20environment,back%20into%20the%20actual%20environment) \[1803.10122\] World Models

https://arxiv.org/abs/1803.10122

[\[25\]](https://arxiv.org/abs/1912.01603#:~:text=,efficiency%2C%20computation%20time) \[1912.01603\] Dream to Control: Learning Behaviors by Latent Imagination

https://arxiv.org/abs/1912.01603

[\[26\]](https://contact-rajeshvinayagam.medium.com/bi-temporal-data-modeling-an-overview-cbba335d1947#:~:text=,was%20recorded%20in%20the%20database) [\[27\]](https://contact-rajeshvinayagam.medium.com/bi-temporal-data-modeling-an-overview-cbba335d1947#:~:text=database%20en,even%20if%20it%20is%20erroneous) [\[30\]](https://contact-rajeshvinayagam.medium.com/bi-temporal-data-modeling-an-overview-cbba335d1947#:~:text=More%20specifically%20the%20temporal%20aspects,valid%20time%20or%20transaction%20time) [\[32\]](https://contact-rajeshvinayagam.medium.com/bi-temporal-data-modeling-an-overview-cbba335d1947#:~:text=A%20database%20which%20considers%20both,transaction%20time%20and%20valid%20time) Bi-Temporal Data Modeling: An Overview | by Rajesh Vinayagam | Medium

https://contact-rajeshvinayagam.medium.com/bi-temporal-data-modeling-an-overview-cbba335d1947

[\[28\]](https://medium.com/@rugvedi.ghule20/truth-maintenance-system-28c7c2ef30f7#:~:text=The%20TMS%20works%20by%20keeping,%E2%80%9D) [\[31\]](https://medium.com/@rugvedi.ghule20/truth-maintenance-system-28c7c2ef30f7#:~:text=The%20TMS%20also%20keeps%20track,integrity%20of%20the%20knowledge%20base) Truth Maintenance System | by Rugvedi Ghule | Medium

https://medium.com/@rugvedi.ghule20/truth-maintenance-system-28c7c2ef30f7

[\[29\]](https://martinfowler.com/articles/bitemporal-history.html#:~:text=Bitemporal%20history%20is%20a%20way,reliable%20history%20of%20its%20modifications) Bitemporal History

https://martinfowler.com/articles/bitemporal-history.html

[\[33\]](https://codelabs.developers.google.com/create-chrome-extension-duetai#:~:text=Codelab%3A%20Build%20a%20Chrome%20Extension,title%3A) Codelab: Build a Chrome Extension in JavaScript using Gemini

https://codelabs.developers.google.com/create-chrome-extension-duetai