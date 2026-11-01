// Synthetic sheet data for the tests. Nothing here comes from the real sheet.
const BH='title,author,status,rating,favourite,cover,currentPage,pages,remain,%,startDate,finishDate,series,seriesNum,type,format,publisher,genre,theme1,theme2,theme3,setting,year,awards,tier,upNextOrder,why,triaged,added,copies,isbn,loaned,loanee,synopsis,notes,id'.split(',');
function book(o){ return BH.map(h=>o[h]??''); }
const B=[
 {title:'The Long Tide',author:'Ada Marlowe',status:'Reading',currentPage:'120',pages:'340',startDate:'2026-10-20',genre:'Literary',type:'Novel',format:'Book',copies:'Kobo | Physical',added:'2026-09-01',synopsis:'A coastal family unravels.',theme1:'family',theme2:'sea',year:'2021',id:'1'},
 {title:'Dust of Stars',author:'Ben Okafor',status:'Reading',currentPage:'60',pages:'500',startDate:'2026-10-25',genre:'Sci-Fi',type:'Novel',format:'Book',series:'Stardust',seriesNum:'1',copies:'PDF',id:'5'},
 {title:'Paper Towns Revisited',author:'Cleo Park',status:'TBR',tier:'Up next',upNextOrder:'1',pages:'280',genre:'Mystery',type:'Novel',copies:'Kobo',why:'Friend recommended',added:'2026-08-10',id:'9'},
 {title:'Iron Orchard',author:'Dana Voss',status:'TBR',tier:'Up next',upNextOrder:'2',pages:'410',genre:'Fantasy',type:'Novel',series:'Orchard',seriesNum:'1',copies:'Physical',id:'13'},
 {title:'Quiet Engines',author:'Eli Ramos',status:'TBR',tier:'Soon',pages:'300',genre:'Sci-Fi',type:'Novel',copies:'Kobo',id:'17'},
 {title:'Salt Road',author:'Fay Lindqvist',status:'TBR',pages:'260',genre:'Historical',type:'Novel',copies:'Kobo | PDF',id:'21'},
 {title:'Dust of Stars 2',author:'Ben Okafor',status:'TBR',pages:'520',genre:'Sci-Fi',type:'Novel',series:'Stardust',seriesNum:'2',id:'25'},
 {title:'The Glass Archive',author:'Gus Hale',status:'Re-read',rating:'5',favourite:'Yes',startDate:'2026-09-02',finishDate:'2026-09-20',pages:'380',currentPage:'380',genre:'Fantasy',type:'Novel',copies:'Physical',id:'29'},
 {title:'The Glass Archive',author:'Gus Hale',status:'Finished',rating:'4.5',favourite:'Yes',startDate:'2025-03-02',finishDate:'2025-03-20',pages:'380',currentPage:'380',genre:'Fantasy',type:'Novel',copies:'Physical',id:'33'},
 {title:'Harbour Lights',author:'Ivy Chen',status:'Finished',rating:'4',startDate:'2026-10-01',finishDate:'2026-10-12',pages:'320',currentPage:'320',genre:'Literary',type:'Novel',copies:'Kobo',id:'37'},
 {title:'Night Ledger',author:'Jon Brandt',status:'Finished',rating:'3',favourite:'Yes',startDate:'2026-08-01',finishDate:'2026-08-30',pages:'450',currentPage:'450',genre:'Thriller',type:'Novel',copies:'PDF',awards:'Booker|Hugo',id:'41'},
 {title:'Slow Orbit',author:'Kia Mbeki',status:'Paused',currentPage:'90',pages:'360',startDate:'2026-07-01',genre:'Sci-Fi',type:'Novel',copies:'Kobo',id:'45'},
 {title:'Brittle Crown',author:'Lou Tanaka',status:'DNF',rating:'2',currentPage:'70',pages:'600',startDate:'2026-06-01',finishDate:'2026-06-10',genre:'Fantasy',type:'Novel',copies:'Physical',id:'49'},
 {title:'Moon Knight Vol 1',author:'Marv Writer',status:'TBR',tier:'Soon',pages:'160',genre:'Superhero',type:'Comic',format:'Graphic novel',publisher:'Marvel',series:'Moon Knight',seriesNum:'1',copies:'PDF',id:'53'},
 {title:'Saga Vol 3',author:'Brian Vaughan',status:'Finished',rating:'5',favourite:'Yes',startDate:'2026-10-13',finishDate:'2026-10-15',pages:'144',currentPage:'144',genre:'Sci-Fi',type:'Comic',format:'Graphic novel',publisher:'Image',series:'Saga',seriesNum:'3',copies:'Physical | Kobo',id:'57'},
 {title:'Akira Book 1',author:'Katsuhiro Otomo',status:'Reading',currentPage:'40',pages:'360',startDate:'2026-10-28',genre:'Sci-Fi',type:'Manga',format:'Manga',publisher:'Kodansha',series:'Akira',seriesNum:'1',copies:'Physical',id:'61'},
].map(book);
const WH='id,added,title,author,series,number,type,format,publisher,stage,waiting,wantAs,checked,checkedOn,release,price,link,seenIn,interest,gift,notes,bookId'.split(',');
function w(o){return WH.map(h=>o[h]??'');}
const W=[
 {id:'WL0001',added:'2026-10-20',title:'Inbox Book One',author:'Zed Author',type:'Novel',format:'Book',stage:'Inbox'},
 {id:'WL0002',added:'2026-10-21',title:'Inbox Comic',author:'Yan Artist',type:'Comic',format:'Comic',publisher:'DC',stage:'Inbox'},
 {id:'WL0003',added:'2026-10-01',title:'Kobo Find',author:'Xan Writer',type:'Novel',format:'Book',stage:'To download',wantAs:'Kobo',checked:'Available',checkedOn:'2026-10-25'},
 {id:'WL0004',added:'2026-10-02',title:'PDF Issue Run',author:'Will Scribe',type:'Comic',format:'Issues',series:'Spawn',number:'12',stage:'To download',wantAs:'PDF',checked:'Unavailable',checkedOn:'2026-10-26'},
 {id:'WL0005',added:'2026-10-03',title:'Unchecked Manga',author:'Vi Mangaka',type:'Manga',format:'Manga',stage:'To download',wantAs:'Kobo'},
 'BLANKW',
 {id:'WL0006',added:'2026-09-03',title:'Buy Me Deluxe',author:'Uma Pen',type:'Comic',format:'Deluxe',stage:'To buy',price:'45',release:'2026-12-01',gift:'TRUE'},
 {id:'WL0007',added:'2026-09-05',title:'Borrow This',author:'Tim Tome',type:'Novel',format:'Book',stage:'To borrow',wantAs:'Library'},
 {id:'WL0008',added:'2026-08-05',title:'Waiting Omnibus',author:'Sue Saga',series:'Orchard',number:'2',type:'Novel',format:'Omnibus',stage:'Waiting',waiting:'Paperback in Jan',release:'2027-01-15'},
 {id:'WL0010',added:'2026-08-07',title:'Saga Vol 3',author:'Brian Vaughan',type:'Comic',format:'Graphic novel',publisher:'Image',stage:'To buy',wantAs:'Physical'},
 {id:'WL0009',added:'2026-08-06',title:'Box Of Wonders',author:'Rae Rune',type:'Novel',format:'Box Set',stage:'To download',wantAs:'PDF',checked:'Available',checkedOn:'2026-10-20'},
].map(o=>o==='BLANKW'?WH.map(()=>''):w(o));
const days=[];
for(let i=40;i>=1;i--){const d=new Date(Date.UTC(2026,9,31)-i*864e5).toISOString().slice(0,10); if(i%7===0)continue; const pages=20+((i*37)%90); days.push([d,String(pages),i%3?'1':'5',i%3?'The Long Tide':'Dust of Stars',String(100+i),d+'T20:00:00','app','30']);}
const base=()=>({
 'Books':[BH,...B],
 'Wishlist':[WH,...W],
 'Series Tracker':[['series','author','publisher','kind','status','released','soldAs','link','notes'],
   ['Spawn','Todd McFarlane','Image','Comic','Following','','Issues','','note a'],['','','','','','','','',''],['Moon Knight','Marv Writer','Marvel','Comic','Ongoing','','Box Set','','']],
 'Reading Lists':[['list','order','title','author','notes','id','bookId'],
   ['Summer Sci-Fi','1','Dust of Stars','Ben Okafor','','RL0001','5'],['Summer Sci-Fi','2','Quiet Engines','Eli Ramos','','RL0002',''],['','','','','','',''],['Classics','1','Moby Unlisted','Herman M','','RL0003','']],
 'Reading Log':[['date','pages','bookId','title','pageReached','loggedAt','source','minutes'],...days],
 'App Settings':[['key','value'],['streakStartDate','2026-09-01'],['streakMinPages','10'],['dailyGoalPages','60'],['yearBookGoal','40']],
 'Contents':[['bookId','stamp','story','start']],
 'Ratings':[['x']],
 'Wishlist archive':[['Title','Author','Status','Type','Format','ETA','Cost','Reading List','Notes','id','Series','Link','bookId']],
 'QUOTES':[['quote','from','character','by','bookId','page','added'],['A line to remember.','The Long Tide','Ada','Ada Marlowe','1','33','2026-10-10'],['Another quote.','Saga','Alana','BKV','57','5','']]
});

// Latest log entry of book 1 ends on its current page (120), so deleting it rolls the book back.
function make(){
  const sheets=base();
  const log=sheets['Reading Log'], last=log[log.length-1];
  last[2]='1'; last[3]='The Long Tide'; last[4]='120';
  return sheets;
}
module.exports={makeSheets:make};
