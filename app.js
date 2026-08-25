function formatBilloreCloudTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  }).format(d);
}
require('dotenv').config();
var path = require('path');
if (String(process.env.DISCORD_BOT_TOKEN || '').trim()) {
  try {
    var childProcess = require('child_process');
    var botChild = childProcess.spawn(process.execPath, [path.join(__dirname, 'bot.js')], {detached:false, stdio:['ignore','inherit','inherit']});
    botChild.on('exit', function(code) { if (code !== 0) console.warn('[Discord Bot] Process exited with code ' + code); });
  } catch (e) { console.warn('[Discord Bot] Could not start presence process:', e.message); }
}
var express = require('express');
var logger = require('morgan');
var index = require('./routes/index');
var admin = require('./routes/admin');
var app = express();
app.locals.formatBilloreCloudTime = formatBilloreCloudTime;
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(function(req,res,next){
  var settingsFile = path.join(__dirname, 'data', 'admin-data.json');
  var fallback = {site_name:'BilloreCloud',site_logo:'https://i.imgur.com/oWNdFZV.png',upi_qr:'',discord_url:'',panel_url:'',panel_api_key:'',panel_type:'pterodactyl',background_image:''};
  try {
    var fs=require('fs'); var raw=JSON.parse(fs.readFileSync(settingsFile,'utf8'));
    res.locals.siteSettings=Object.assign({},fallback,raw.settings||{});
    var bg=res.locals.siteSettings.background_image;
    if(typeof bg==='string' && bg.indexOf('/uploads/')===0){
      var bgPath=path.join(__dirname,'public',bg.replace(/^\/uploads\//,'uploads/'));
      if(fs.existsSync(bgPath)){
        var ext=path.extname(bgPath).toLowerCase();
        var mime=ext==='.jpg'||ext==='.jpeg'?'image/jpeg':ext==='.webp'?'image/webp':ext==='.gif'?'image/gif':'image/png';
        res.locals.siteSettings.background_image='data:'+mime+';base64,'+fs.readFileSync(bgPath).toString('base64');
        raw.settings=Object.assign({},raw.settings,{background_image:res.locals.siteSettings.background_image});
        try{fs.writeFileSync(settingsFile,JSON.stringify(raw,null,2));}catch(e){}
      }
    }
  } catch(e){res.locals.siteSettings=fallback;}
  next();
});
app.use(express.urlencoded({extended:true}));
app.use(require('express-session')({secret:process.env.SESSION_SECRET||'billorecloud-change-this-secret',resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',maxAge:1000*60*60*24}}));
app.use(function(req,res,next){res.locals.currentUser=req.session.user||null;res.locals.isAdmin=!!req.session.admin;next();});
app.use('/',index); app.use('/admin',admin);
app.use(function(req,res,next){var err=new Error('Not Found');err.status=404;next(err);});
app.use(function(err,req,res,next){res.status(err.status||500);res.render('error',{status:err.status,message:err.message});});
module.exports=app;
