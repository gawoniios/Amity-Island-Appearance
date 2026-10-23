const {Plugin, PluginSettingTab, Setting, Notice, normalizePath} = require('obsidian');
const ROOT_PALETTE = [
  { match:'TOWN HALL',name:'Town Hall',color:'#729DA7',ink:'#172F35'},
  { match:'QUINT',name:"Quint's Shack",color:'#C16C59',ink:'#2B211D'},
  { match:'THE ORCA',name:'The Orca',color:'#D6B46B',ink:'#302719'},
  { match:'PUBLIC LIBRARY',name:'Amity Public Library',color:'#9784A6',ink:'#201B2D'},
  { match:'OCEANOGRAPHIC',name:'Oceanographic Institute',color:'#729A85',ink:'#162D26'},
  { match:'GAZETTE',name:'Amity Gazette',color:'#C78694',ink:'#2A1E26'},
  { match:'POLICE',name:'Police Department',color:'#708FAA',ink:'#142B3B'},
  { match:'HARDWARE',name:'Amity Hardware',color:'#C99570',ink:'#342318'}
];
const DEFAULTS={enabled:true,depthVariation:0.14,rootColors:Object.fromEntries(ROOT_PALETTE.map(x=>[x.match,x.color]))};
function mixHex(a,b,t){const n=v=>parseInt(v,16), blend=(i)=>Math.round(n(a.slice(i,i+2))*(1-t)+n(b.slice(i,i+2))*t).toString(16).padStart(2,'0');return '#'+blend(1)+blend(3)+blend(5);}
function luminous(hex){const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=0.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];}
function textFor(bg){return luminous(bg)>.39?'#172C36':'#FFFFFF';}
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0;}
function folderTitle(el){return el.querySelector(':scope > .nav-folder-title');}
function getFolderPath(el){return el.getAttribute('data-path')||folderTitle(el)?.getAttribute('data-path')||'';}
function getDepth(folder){let n=0,p=folder.parentElement;while(p){if(p.classList?.contains('nav-folder'))n++;p=p.parentElement;}return n;}
class AmityAppearance extends Plugin {
 async onload(){this.settings=Object.assign({},DEFAULTS,await this.loadData());this.settings.rootColors=Object.assign({},DEFAULTS.rootColors,this.settings.rootColors||{});
 this.addSettingTab(new AppearanceSettings(this.app,this));
 this.addCommand({id:'refresh-folder-colors',name:'Refresh Amity folder colors',callback:()=>this.repaint()});
 this.applyEnabled();
 this.registerEvent(this.app.workspace.on('layout-change',()=>this.schedulePaint()));
 this.registerEvent(this.app.vault.on('rename',()=>this.schedulePaint()));
 this.registerEvent(this.app.vault.on('create',()=>this.schedulePaint()));
 this.registerEvent(this.app.vault.on('delete',()=>this.schedulePaint()));
 this.observer=new MutationObserver(()=>this.schedulePaint());this.observer.observe(document.body,{childList:true,subtree:true});
 this.register(()=>this.observer.disconnect());this.schedulePaint();
 }
 onunload(){document.body.classList.remove('amity-folder-cards');this.clearPaint();if(this.timer)clearTimeout(this.timer);}
 async save(){await this.saveData(this.settings);this.applyEnabled();this.schedulePaint();}
 applyEnabled(){document.body.classList.toggle('amity-folder-cards',!!this.settings.enabled);if(!this.settings.enabled)this.clearPaint();}
 schedulePaint(){if(!this.settings.enabled||this.timer)return;this.timer=setTimeout(()=>{this.timer=null;this.repaint()},90);}
 clearPaint(){document.querySelectorAll('.nav-files-container .nav-folder.amity-root-card,.nav-files-container .nav-folder.amity-child-folder').forEach(el=>{el.classList.remove('amity-root-card','amity-child-folder');for(const p of ['--amity-root-bg','--amity-root-ink','--amity-child-bg'])el.style.removeProperty(p);});}
 repaint(){if(!this.settings.enabled)return;
  const all=[...document.querySelectorAll('.nav-files-container .nav-folder')].filter(x=>getFolderPath(x));
  for(const el of all){
   const path=getFolderPath(el),parts=path.split('/').filter(Boolean),root=parts[0]||'';
   const match=ROOT_PALETTE.find(x=>root.toUpperCase().includes(x.match));
   const color=match?(this.settings.rootColors[match.match]||match.color):'#839CA2';
   const ink=match?match.ink:textFor(color);
   // Use actual path depth, not a theme-specific DOM root wrapper.
   const depth=parts.length-1;
   el.classList.toggle('amity-root-card',depth===0);
   el.classList.toggle('amity-child-folder',depth>0);
   if(depth===0){el.style.setProperty('--amity-root-bg',color);el.style.setProperty('--amity-root-ink',ink);}
   else {
    const hashVal=hash(path),variation=(hashVal%7)*0.009;
    const factor=Math.min(.21,.05+this.settings.depthVariation*.35+variation+Math.min(depth,5)*.008);
    el.style.setProperty('--amity-child-bg',mixHex(color,'#FFFFFF',factor));
   }
  }
 }

}
class AppearanceSettings extends PluginSettingTab{
 constructor(app,plugin){super(app,plugin);this.plugin=plugin;}
 display(){const {containerEl:c,plugin:p}=this;c.empty();c.createEl('h2',{text:'Amity Island appearance'});
 new Setting(c).setName('Colorful folder cards').setDesc('One continuous card per top-level folder; no gaps inside nested folders.').addToggle(t=>t.setValue(p.settings.enabled).onChange(async v=>{p.settings.enabled=v;await p.save();}));
 new Setting(c).setName('Subfolder color difference').setDesc('Subtle summer-toned variations without dark bands.').addSlider(s=>s.setLimits(.02,.25,.01).setValue(p.settings.depthVariation).setDynamicTooltip().onChange(async v=>{p.settings.depthVariation=v;await p.save();}));
 c.createEl('h3',{text:'Town palette'});c.createEl('p',{text:'Eight muted summer colors for the Amity Island buildings. Changes take effect immediately.'});
 for(const entry of ROOT_PALETTE)new Setting(c).setName(entry.name).addColorPicker(i=>i.setValue(p.settings.rootColors[entry.match]).onChange(async v=>{p.settings.rootColors[entry.match]=v;await p.save();}));
 new Setting(c).setName('Reset summer palette').addButton(b=>b.setButtonText('Restore').onClick(async()=>{p.settings.rootColors={...DEFAULTS.rootColors};await p.save();this.display();}));
 c.createEl('p',{text:'Fonts are embedded: Amity Jack headings, Spritulo note text, and TrueTypewriter Polyglott interface. No external font installation required.'});
 }
}
module.exports=AmityAppearance;
