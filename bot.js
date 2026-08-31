require('dotenv').config();
const fs=require('fs'); const path=require('path');
const {Client,GatewayIntentBits,ActivityType}=require('discord.js');
const discordService=require('./discord-service');
const adminFile=path.join(__dirname,'data','admin-data.json'); const usersFile=path.join(__dirname,'data','users.json');
function read(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){return fallback;}}
const adminData=read(adminFile,{settings:{}}); const adminSettings=adminData.settings||{};
const token=String(adminSettings.discord_bot_token||process.env.DISCORD_BOT_TOKEN||'').trim();
if(!token){console.warn('[Discord Bot] DISCORD_BOT_TOKEN is not configured.');process.exit(0);}
const client=new Client({intents:[GatewayIntentBits.Guilds]});
function write(file,v){fs.writeFileSync(file,JSON.stringify(v,null,2));}
function template(t,v){let s=String(t||'');Object.keys(v).forEach(k=>s=s.split('{{'+k+'}}').join(String(v[k]??'')));return s;}
client.once('ready',async()=>{client.user.setPresence({status:'dnd',activities:[{name:'BilloreCloud Orders',type:ActivityType.Watching}]});console.log(`[Discord Bot] Online as ${client.user.tag} — status: Do Not Disturb`);const r=await discordService.createGuildStructure();if(!r.ok) console.warn('[Discord Bot] Server structure not ready:',r.reason||r.status);});
client.on('interactionCreate',async interaction=>{
 if(!interaction.isButton()) return; const parts=String(interaction.customId||'').split(':');
 if(parts.length!==2||!['bc_order_accept','bc_order_reject','bc_order_complete'].includes(parts[0])) return;
 const id=parts[1]; const data=read(adminFile,{orders:[],settings:{}}); data.orders=Array.isArray(data.orders)?data.orders:[]; const order=data.orders.find(o=>String(o.id)===id);
 if(!order) return interaction.reply({content:'Order not found.',ephemeral:true});
 if(parts[0]==='bc_order_complete'&&!['paid','payment_review'].includes(String(order.status))) return interaction.reply({content:`Order cannot be completed from ${order.status}.`,ephemeral:true});
 if(parts[0]!=='bc_order_complete'&&!['payment_review','awaiting_payment'].includes(String(order.status))) return interaction.reply({content:`Order is already ${order.status}.`,ephemeral:true});
 const accepted=parts[0]==='bc_order_accept'; const completed=parts[0]==='bc_order_complete';
 order.status=completed?'completed':(accepted?'paid':'rejected'); order.payment_status=(accepted||completed)?'paid':'rejected'; order.updated_at=new Date().toISOString(); write(adminFile,data);
 const users=read(usersFile,[]); const user=users.find(u=>String(u.id)===String(order.user_id)); const settings=data.settings||{};
 const msg=completed?template(settings.discord_msg_complete||'✅ {{site_name}} order completed\n\nOrder ID: {{order_id}}\nProduct: {{product}}\nAmount: ₹{{amount}}\nStatus: Completed\n\nYour order has been completed successfully.',{site_name:settings.site_name||'BilloreCloud',name:user?.name,email:user?.email,order_id:order.id,product:order.product_name,amount:Number(order.price||0).toFixed(2),status:'Completed'}):(accepted?template(settings.discord_msg_payment||'💳 {{site_name}} payment verified\n\nOrder ID: {{order_id}}\nProduct: {{product}}\nAmount: ₹{{amount}}\nStatus: Payment Accepted\n\nYour payment has been verified.',{site_name:settings.site_name||'BilloreCloud',name:user?.name,email:user?.email,order_id:order.id,product:order.product_name,amount:Number(order.price||0).toFixed(2),status:'Payment Accepted'}):template(settings.discord_msg_reject||'❌ {{site_name}} order rejected\n\nOrder ID: {{order_id}}\nProduct: {{product}}\nAmount: ₹{{amount}}\nStatus: Rejected\n\nPlease contact support if you need help.',{site_name:settings.site_name||'BilloreCloud',name:user?.name,email:user?.email,order_id:order.id,product:order.product_name,amount:Number(order.price||0).toFixed(2),status:'Rejected'}));
 const dm=await discordService.sendDM(user?.discord_id,msg,{title:completed?'✅ Order Completed':(accepted?'💳 Payment Accepted':'❌ Order Rejected'),color:completed||accepted?0x57F287:0xED4245,thumbnail:settings.site_logo,footer:settings.site_name||'BilloreCloud'});
 const title=completed?'✅ Order Completed':(accepted?'💳 Payment Accepted':'❌ Order Rejected'); const statusText=completed?'Completed':(accepted?'Payment Accepted':'Rejected');
 const components=completed||!accepted?[]:[{type:1,components:[{type:2,style:3,label:'Complete Order',custom_id:'bc_order_complete:'+order.id},{type:2,style:4,label:'Reject',custom_id:'bc_order_reject:'+order.id}]}];
 await interaction.update({embeds:[{title,description:`**Order ID:** \`${order.id}\`\n**Client:** ${order.user_name||'Unknown'}\n**Product:** ${order.product_name||'—'}\n**Amount:** ₹${Number(order.price||0).toFixed(2)}\n**Status:** ${statusText}`,color:completed||accepted?0x57F287:0xED4245,timestamp:new Date().toISOString(),footer:{text:settings.site_name||'BilloreCloud'}}],components});
 if(completed){const completeNotice=await discordService.postCompleteOrder(order,settings);if(!completeNotice.sent) console.warn('[Discord Bot] Complete channel post failed:',completeNotice.reason||completeNotice.status);}
 if(!dm.sent) console.warn('[Discord Bot] Client DM failed:',dm.reason,dm.status||'',dm.error||'');
});
client.on('error',e=>console.error('[Discord Bot] Client error:',e.message)); process.on('SIGTERM',()=>client.destroy()); process.on('SIGINT',()=>client.destroy());
client.login(token).catch(e=>{console.error('[Discord Bot] Login failed:',e.message);process.exit(1);});
