import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotSender } from '../utils/botSender.js';
import { groupPostVerifier } from '../utils/botDeliveryVerifier.js';

const config = { botApiBaseUrl:'https://bot.example/v2',botToken:'secret',botId:'bot@company',botType:'user',botTeamId:'',botTargetEmail:'' };
afterEach(() => vi.unstubAllGlobals());
describe('Bot delivery evidence', () => {
  it.each([
    [{ data:{ queueId:'queue-1' }, message:'success' },false,true,undefined,'queue-1'],
    [{ data:{ postId:'post-1',chatId:'chat-1' } },true,true,'post-1',undefined],
    [{ success:false,message:'not a member' },false,false,undefined,undefined],
    [{ data:{ error:'rate limited' } },false,false,undefined,undefined],
    [{ code:500,message:'failed' },false,false,undefined,undefined],
    [{ data:{postId:'post-1',chatId:'wrong-chat'} },false,false,undefined,undefined],
    [{},false,false,undefined,undefined],
  ])('distinguishes queue acceptance from a post receipt: %j',async(body,sent,accepted,messageId,queueId)=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:201,statusText:'Created',text:async()=>JSON.stringify(body)}));
    const r=await new BotSender(config).sendMarkdown('','notice',{targetGroupId:'chat-1'});
    expect(r.sent).toBe(sent);expect(Boolean(r.accepted)).toBe(accepted);
    expect(r.messageId).toBe(messageId);expect(r.queueId).toBe(queueId);
  });
  it('does not treat an HTML 200 as a receipt',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,text:async()=>'<html>login</html>'}));
    expect((await new BotSender(config).sendMarkdown('','notice',{targetGroupId:'chat-1'})).sent).toBe(false);
  });
  it('requires the intended chat, bot, fresh timestamp and unambiguous content',async()=>{
    const at=Date.now()/1000;const post={id:'post-1',chatId:'chat-1',text:'notice',creatorId:'bot',createdAt:new Date(at*1000).toISOString()};
    const listPosts=vi.fn().mockResolvedValue([post]);const verify=groupPostVerifier({listPosts},config.botId);
    const input={chatId:'chat-1',text:'notice',sinceAt:at};
    expect(await verify(input)).toEqual({messageId:'post-1',chatId:'chat-1'});
    for(const change of [{chatId:'other'},{creatorId:'other'},{text:'different'},{createdAt:new Date((at-10)*1000).toISOString()}]){
      listPosts.mockResolvedValue([{...post,...change}]);expect(await verify(input)).toBeUndefined();
    }
    listPosts.mockResolvedValue([post,post]);expect(await verify(input)).toBeUndefined();
  });
});
