const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
// ربط Supabase: المفتاح العام (publishable) آمن للوجود هنا. ممنوع وضع أي مفتاح secret / service_role.
const SUPABASE_URL="https://qhwjowcqgnxzhlyfwqif.supabase.co";
const SUPABASE_KEY="sb_publishable_j70x7yBj11mCP0E839ndZw_yS-1mvOG";
const sb=(window.supabase&&window.supabase.createClient)?window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY):null;
const SHIPPING={"القاهرة":55,"الجيزة":55,"الإسكندرية":65,"القليوبية":60,"الشرقية":65,"الدقهلية":70,"الغربية":70,"المنوفية":65,"البحيرة":75,"كفر الشيخ":75,"دمياط":75,"بورسعيد":75,"الإسماعيلية":70,"السويس":75,"الفيوم":75,"بني سويف":80,"المنيا":90,"أسيوط":100,"سوهاج":110,"قنا":120,"الأقصر":125,"أسوان":140,"مطروح":130,"شمال سيناء":140,"جنوب سيناء":160,"البحر الأحمر":130,"الوادي الجديد":160};
// مجموعات المقاسات الجاهزة (تقدري تعدلي الأرقام من هنا)
const SIZE_SETS={
 baby:{label:"بيبي 6M – 24M",sizes:["6M","12M","18M","24M"]},
 kids1:{label:"أطفال 2Y – 6Y",sizes:["2Y","3Y","4Y","5Y","6Y"]},
 kids2:{label:"أطفال 4Y – 8Y",sizes:["4Y","5Y","6Y","7Y","8Y"]},
 junior1:{label:"جونيور 9Y – 14Y",sizes:["9Y","10Y","11Y","12Y","13Y","14Y"]},
 junior2:{label:"جونيور 10Y – 16Y",sizes:["10Y","11Y","12Y","13Y","14Y","15Y","16Y"]},
 custom:{label:"مقاسات مخصصة",sizes:[]}
};
const STATUS_AR={new:"جديد",confirmed:"مؤكد",preparing:"قيد التجهيز",shipped:"تم الشحن",delivered:"تم التسليم",cancelled:"ملغي"};
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const uuid=()=>(crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{let r=Math.random()*16|0;return(c==="x"?r:(r&3|8)).toString(16)}));
let products=[],cart=store.get("fs_cart",[]),settings={whatsapp:""},isAdmin=false,adminOrders=[],fv=[];
let activeFilter="الكل",activeCategory=null,priceMode="retail";
const money=n=>Number(n||0).toLocaleString("ar-EG")+" ج.م";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const saveCart=()=>store.set("fs_cart",cart);
function toast(t){let x=$("#toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2800)}
function sizeRank(l){const m=/^(\d+(?:\.\d+)?)\s*([MY])$/i.exec(String(l).trim());return m?(m[2].toUpperCase()==="M"?0:1000)+Number(m[1]):5000}
function sortSizes(o){return Object.fromEntries(Object.entries(o||{}).sort((a,b)=>sizeRank(a[0])-sizeRank(b[0])||a[0].localeCompare(b[0])))}
function stock(p){return (p.variants||[]).reduce((t,v)=>t+Object.values(v.sizes||{}).reduce((a,b)=>a+Number(b),0),0)}

/* ============ تحميل البيانات من Supabase ============ */
async function loadData(){
 if(!sb){$("#productGrid").innerHTML='<div class="empty">تعذر تحميل المتجر. تأكدي من الاتصال بالإنترنت وحدّثي الصفحة.</div>';return}
 const [p,v,s]=await Promise.all([
  sb.from("products").select("*").order("created_at",{ascending:false}),
  sb.from("product_variants").select("*").order("sort_order",{ascending:true}),
  sb.from("product_sizes").select("*")
 ]);
 const err=p.error||v.error||s.error;
 if(err){console.warn(err);$("#productGrid").innerHTML='<div class="empty">تعذر تحميل المنتجات حالياً. حاولي مرة أخرى بعد قليل.</div>';return}
 const map={};
 products=p.data.map(r=>{const o={id:r.id,name:r.name,price:Number(r.retail_price),wholesalePrice:Number(r.wholesale_price),wholesaleMin:r.wholesale_min||1,category:r.category,gender:r.gender,description:r.description||"",featured:!!r.featured,active:r.is_active!==false,image:r.image_url||"",variants:[]};map[o.id]=o;return o});
 const vmap={};
 v.data.forEach(r=>{const pr=map[r.product_id];if(!pr)return;const o={id:r.id,color:r.color_name,image:r.image_url||"",sizes:{}};pr.variants.push(o);vmap[r.id]=o});
 s.data.forEach(r=>{let o=r.variant_id?vmap[r.variant_id]:(map[r.product_id]?.variants[0]);if(o)o.sizes[r.size_label]=Number(r.stock)});
 products.forEach(pr=>{if(!pr.variants.length)pr.variants.push({id:null,color:"متاح",image:pr.image,sizes:{}});pr.variants.forEach(x=>x.sizes=sortSizes(x.sizes))});
 cart=cart.filter(i=>products.some(p=>p.id===i.id&&p.variants[i.colorIndex||0]));saveCart();
 renderProducts();renderCart();
}
async function loadSettings(){
 if(!sb)return;
 const {data}=await sb.from("store_settings").select("value").eq("key","public_contact").maybeSingle();
 settings.whatsapp=String(data?.value?.whatsapp||"").replace(/\D/g,"");
}

/* ============ المتجر ============ */
function visibleProducts(){return products.filter(p=>p.active)}
function sizeOptions(v){const e=Object.entries(v.sizes||{});return e.length?e.map(([z,q])=>`<option value="${esc(z)}" ${q<=0?"disabled":""}>${esc(z)} — ${q>0?"متاح "+q:"نفذ"}</option>`).join(""):'<option value="">غير متاح</option>'}
function renderProducts(){
 let list=visibleProducts().filter(p=>(!activeCategory||p.category===activeCategory)&&(activeFilter==="الكل"||(activeFilter==="الأكثر مبيعاً"?p.featured:p.gender===activeFilter)));
 $("#productGrid").innerHTML=list.length?list.map(p=>{let v=p.variants[0];return `<article class="product-card"><div class="product-image" id="photo-${p.id}">${v.image?`<img src="${esc(v.image)}" alt="${esc(p.name)}" onerror="this.remove()">`:`<span class="placeholder">✿</span>`}</div><div class="product-info"><small>${esc(p.category)} · ${esc(p.gender)}</small><h3>${esc(p.name)}</h3><div class="price-pair"><span>قطاعي <b>${money(p.price)}</b></span><span>جملة <b>${money(p.wholesalePrice||p.price)}</b></span></div><label>اللون<select id="color-${p.id}" onchange="changeProductColor('${p.id}')">${p.variants.map((x,i)=>`<option value="${i}">${esc(x.color)}</option>`).join("")}</select></label><label>المقاس<select id="size-${p.id}">${sizeOptions(v)}</select></label><button class="add-btn" onclick="addToCart('${p.id}')">أضيفي للسلة</button></div></article>`}).join(""):'<div class="empty">لا توجد منتجات في هذا القسم حالياً.</div>';
}
function changeProductColor(id){let p=products.find(x=>x.id===id),v=p.variants[Number($("#color-"+id).value)];$("#size-"+id).innerHTML=sizeOptions(v);$("#photo-"+id).innerHTML=v.image?`<img src="${esc(v.image)}" alt="${esc(p.name)}">`:'<span class="placeholder">✿</span>'}
function addToCart(id){
 let p=products.find(x=>x.id===id),vi=Number($(`#color-${id}`).value||0),v=p.variants[vi],size=$(`#size-${id}`).value;
 if(!size||!(v.sizes[size]>0))return toast("المقاس غير متاح");
 let item=cart.find(x=>x.id===id&&x.size===size&&x.colorIndex===vi&&x.mode===priceMode);
 if(item){if(item.qty>=v.sizes[size])return toast("الكمية المطلوبة غير متاحة");item.qty++}else cart.push({id,size,colorIndex:vi,color:v.color,qty:1,mode:priceMode});
 saveCart();renderCart();toast("تمت الإضافة للسلة");
}
function itemPrice(item){let p=products.find(x=>x.id===item.id);return Number(item.mode==="wholesale"?(p?.wholesalePrice??p?.price):(p?.price)||0)}
function subtotal(){return cart.reduce((sum,i)=>sum+itemPrice(i)*i.qty,0)}
function renderCart(){
 $("#cartCount").textContent=cart.reduce((a,i)=>a+i.qty,0);$("#cartSubtotal").textContent=money(subtotal());
 $("#cartItems").innerHTML=cart.length?cart.map((i,n)=>{let p=products.find(x=>x.id===i.id);return `<div class="cart-row"><div><b>${esc(p?.name||"منتج")}</b><small>${i.mode==="wholesale"?"سعر جملة":"سعر قطاعي"} · اللون: ${esc(i.color||"-")} · المقاس: ${esc(i.size)} · ${money(itemPrice(i))}</small><button onclick="removeCart(${n})">حذف</button></div><input type="number" min="1" max="${p?.variants?.[i.colorIndex||0]?.sizes?.[i.size]||1}" value="${i.qty}" onchange="changeQty(${n},this.value)"></div>`}).join(""):'<div class="empty">السلة فارغة — اختاري منتجاتك أولاً ♥</div>';
}
function removeCart(n){cart.splice(n,1);saveCart();renderCart()}
function changeQty(n,v){let i=cart[n],p=products.find(x=>x.id===i.id),q=Math.max(1,Math.min(Number(v)||1,p.variants[i.colorIndex||0].sizes[i.size]||1));i.qty=q;saveCart();renderCart()}
function showPanel(id){$(id).classList.add("show")}
function closeAll(){$$(".overlay").forEach(x=>x.classList.remove("show"))}
$("#cartOpen").onclick=()=>{renderCart();showPanel("#cartPanel")};
$("#checkoutOpen").onclick=()=>{if(!cart.length)return toast("السلة فارغة");closeAll();renderGovernorates();updateCheckout();showPanel("#checkoutPanel")};
$$("[data-close]").forEach(b=>b.onclick=closeAll);
$$(".overlay").forEach(o=>o.addEventListener("click",e=>{if(e.target===o)closeAll()}));
$$(".filter").forEach(b=>b.onclick=()=>{$$(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");activeFilter=b.dataset.filter;activeCategory=null;renderProducts()});
$$(".category-tile").forEach(b=>b.onclick=()=>{activeCategory=b.dataset.cat;activeFilter="الكل";$$(".filter").forEach(x=>x.classList.toggle("active",x.dataset.filter==="الكل"));$("#shop").scrollIntoView();renderProducts()});
function renderGovernorates(){let g=$("#governorate");g.innerHTML='<option value="">اختاري المحافظة</option>'+Object.keys(SHIPPING).map(x=>`<option>${x}</option>`).join("")}
function updateCheckout(){let g=$("#governorate").value,ship=SHIPPING[g];$("#checkoutSubtotal").textContent=money(subtotal());$("#shippingCost").textContent=ship?money(ship):"—";$("#checkoutTotal").textContent=ship?money(subtotal()+ship):"—"}
$("#governorate").onchange=updateCheckout;
$("#globalPriceMode").onchange=e=>{priceMode=e.target.value};
$("#checkoutForm").onsubmit=e=>{
 e.preventDefault();if(!cart.length)return toast("السلة فارغة");
 let f=new FormData(e.target),g=f.get("governorate"),ship=SHIPPING[g];if(!ship)return toast("اختاري المحافظة");
 if(!settings.whatsapp)return toast("رقم واتساب المتجر غير مضبوط بعد. تواصلي مع الإدارة.");
 let bad=cart.find(i=>i.mode==="wholesale"&&i.qty<(products.find(p=>p.id===i.id)?.wholesaleMin||1));
 if(bad){let p=products.find(x=>x.id===bad.id);return toast(`الحد الأدنى لجملة ${p.name}: ${p.wholesaleMin||1} قطعة`)}
 let number="FS"+Date.now().toString().slice(-7),sub=subtotal();
 let items=cart.map(i=>({name:products.find(p=>p.id===i.id)?.name||"منتج",color:i.color||"",size:i.size,qty:i.qty,mode:i.mode,price:itemPrice(i)}));
 let lines=items.map(i=>`- ${i.name} | ${i.color} | ${i.size} × ${i.qty} (${i.mode==="wholesale"?"جملة":"قطاعي"}) = ${money(i.price*i.qty)}`);
 let msg=[`طلب جديد ${number}`,`الاسم: ${f.get("name")}`,`الموبايل: ${f.get("phone")}`,`العنوان: ${g} - ${f.get("area")} - ${f.get("address")}`,...lines,`المنتجات: ${money(sub)}`,`الشحن: ${money(ship)}`,`الإجمالي: ${money(sub+ship)}`,`الدفع عند الاستلام`].join("\n");
 window.open("https://wa.me/"+settings.whatsapp+"?text="+encodeURIComponent(msg),"_blank");
 // تسجيل الطلب في قاعدة البيانات (محاولة إضافية، لا تعطل الطلب لو فشلت)
 if(sb)sb.from("orders").insert({order_number:number,customer_name:String(f.get("name")),phone:String(f.get("phone")),governorate:g,area:String(f.get("area")),address:String(f.get("address")),notes:(String(f.get("notes")||"")+"\n"+lines.join("\n")).trim(),sales_type:items.some(i=>i.mode==="wholesale")?"wholesale":"retail",subtotal:sub,shipping_cost:ship,total:sub+ship}).then(r=>{if(r.error)console.warn(r.error.message)});
 cart=[];saveCart();renderCart();e.target.reset();closeAll();toast("تم تجهيز الطلب. أكملي إرساله عبر واتساب.");
};

/* ============ الإدارة (تسجيل دخول Supabase) ============ */
async function refreshAdmin(){
 isAdmin=false;if(!sb)return;
 const {data:{session}}=await sb.auth.getSession();if(!session)return;
 const {data}=await sb.from("profiles").select("role").eq("id",session.user.id).maybeSingle();
 isAdmin=data?.role==="admin";
}
async function enterAdmin(){
 await refreshAdmin();
 $("#adminLogin").hidden=isAdmin;$("#adminContent").hidden=!isAdmin;
 if(isAdmin){await loadData();await loadOrders();resetProductForm();renderAdmin()}
}
$("#adminOpen").onclick=async()=>{showPanel("#adminPanel");await enterAdmin()};
$("#adminLoginBtn").onclick=async()=>{
 if(!sb)return toast("تعذر الاتصال بالخادم");
 const email=$("#adminEmail").value.trim(),password=$("#adminPass").value;
 if(!email||!password)return toast("اكتبي الإيميل وكلمة السر");
 const {error}=await sb.auth.signInWithPassword({email,password});
 if(error)return toast("بيانات الدخول غير صحيحة");
 $("#adminPass").value="";
 await refreshAdmin();
 if(!isAdmin){await sb.auth.signOut();return toast("هذا الحساب ليس حساب إدارة")}
 await enterAdmin();
};
$("#adminLogout").onclick=async()=>{if(sb)await sb.auth.signOut();isAdmin=false;$("#adminLogin").hidden=false;$("#adminContent").hidden=true;await loadData()};
$$(".admin-tabs button").forEach(b=>b.onclick=()=>{$$(".admin-tabs button").forEach(x=>x.classList.remove("active"));b.classList.add("active");["productsTab","ordersTab","settingsTab"].forEach(id=>$("#"+id).hidden=id!==b.dataset.tab);renderAdmin()});

/* ---- نموذج المنتج: ألوان + صورة لكل لون + مجموعة مقاسات ---- */
const newVariant=()=>({color:"",image:"",set:"custom",sizes:{},busy:false});
function detectSet(sizes){const keys=Object.keys(sizes).sort().join();for(const [k,s] of Object.entries(SIZE_SETS)){if(k!=="custom"&&s.sizes.slice().sort().join()===keys)return k}return "custom"}
function renderVariantBuilder(){
 $("#variantBuilder").innerHTML=fv.map((v,i)=>`<div class="vcard" data-i="${i}">
  <div class="vhead"><input class="v-color" placeholder="اسم اللون (مثال: أحمر)" value="${esc(v.color)}"><button type="button" class="v-del" title="حذف اللون">×</button></div>
  <div class="vimg"><div class="vpreview">${v.image?`<img src="${esc(v.image)}" alt="">`:"✿"}</div><label class="upload-btn">📷 ${v.image?"تغيير الصورة":"إضافة صورة"}<input class="v-file" type="file" accept="image/*"></label><span class="vstatus">${v.busy?"جاري رفع الصورة...":""}</span></div>
  <label>مجموعة المقاسات<select class="v-set">${Object.entries(SIZE_SETS).map(([k,s])=>`<option value="${k}" ${v.set===k?"selected":""}>${s.label}</option>`).join("")}</select></label>
  <div class="vsizes">${Object.entries(sortSizes(v.sizes)).map(([z,q])=>`<div class="vsize"><b>${esc(z)}</b><input class="v-qty" data-size="${esc(z)}" type="number" min="0" value="${q}" placeholder="الكمية"><button type="button" class="v-size-del" data-size="${esc(z)}" title="حذف المقاس">×</button></div>`).join("")||'<span class="hint">اختاري مجموعة مقاسات أو أضيفي مقاساً.</span>'}</div>
  <div class="vaddsize"><input class="v-newsize" placeholder="مقاس إضافي مثل 7Y"><button type="button" class="v-add-size">+ مقاس</button></div>
 </div>`).join("");
}
function applySet(i,key){
 const v=fv[i];v.set=key;
 if(key!=="custom"){const old=v.sizes;v.sizes={};SIZE_SETS[key].sizes.forEach(z=>v.sizes[z]=Number(old[z]||0))}
}
async function compressImage(file,max=900,q=.82){
 const bmp=await createImageBitmap(file);const sc=Math.min(1,max/Math.max(bmp.width,bmp.height));
 const c=document.createElement("canvas");c.width=Math.round(bmp.width*sc);c.height=Math.round(bmp.height*sc);
 c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);
 return await new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error("تعذر معالجة الصورة")),"image/jpeg",q));
}
async function uploadVariantImage(i,file){
 if(!sb)return toast("تعذر الاتصال بالخادم");
 fv[i].busy=true;renderVariantBuilder();
 try{
  const blob=await compressImage(file),path=uuid()+".jpg";
  const {error}=await sb.storage.from("product-images").upload(path,blob,{contentType:"image/jpeg",upsert:false});
  if(error)throw error;
  fv[i].image=sb.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  toast("تم رفع الصورة");
 }catch(e){toast("فشل رفع الصورة: "+(e.message||e))}
 fv[i].busy=false;renderVariantBuilder();
}
const vb=$("#variantBuilder");
vb.addEventListener("input",e=>{const c=e.target.closest(".vcard");if(!c)return;const i=Number(c.dataset.i);
 if(e.target.classList.contains("v-color"))fv[i].color=e.target.value;
 if(e.target.classList.contains("v-qty"))fv[i].sizes[e.target.dataset.size]=Math.max(0,Number(e.target.value)||0)});
vb.addEventListener("change",e=>{const c=e.target.closest(".vcard");if(!c)return;const i=Number(c.dataset.i);
 if(e.target.classList.contains("v-set")){applySet(i,e.target.value);renderVariantBuilder()}
 if(e.target.classList.contains("v-file")&&e.target.files[0])uploadVariantImage(i,e.target.files[0])});
vb.addEventListener("click",e=>{const c=e.target.closest(".vcard");if(!c)return;const i=Number(c.dataset.i);
 if(e.target.classList.contains("v-del")){fv.splice(i,1);if(!fv.length)fv.push(newVariant());renderVariantBuilder()}
 if(e.target.classList.contains("v-size-del")){delete fv[i].sizes[e.target.dataset.size];fv[i].set="custom";renderVariantBuilder()}
 if(e.target.classList.contains("v-add-size")){const inp=c.querySelector(".v-newsize"),z=inp.value.trim().toUpperCase();if(!z)return;if(!(z in fv[i].sizes))fv[i].sizes[z]=0;fv[i].set=detectSet(fv[i].sizes);renderVariantBuilder()}});
$("#addColor").onclick=()=>{fv.push(newVariant());renderVariantBuilder()};
function resetProductForm(){const f=$("#productForm");f.reset();f.elements.id.value="";f.elements.active.checked=true;fv=[newVariant()];renderVariantBuilder()}
$("#productForm").onsubmit=async e=>{
 e.preventDefault();if(!sb||!isAdmin)return toast("سجّلي دخول الإدارة أولاً");
 const f=new FormData(e.target);
 if(fv.some(v=>v.busy))return toast("استني لحد ما الصورة تخلص رفع");
 const vars=fv.filter(v=>v.color.trim()||Object.keys(v.sizes).length);
 if(!vars.length||vars.some(v=>!v.color.trim()||!Object.keys(v.sizes).length))return toast("كل لون لازم يكون له اسم ومقاسات");
 const id=f.get("id")||uuid(),btn=e.submitter||e.target.querySelector("[type=submit]");btn.disabled=true;
 try{
  let r=await sb.from("products").upsert({id,name:String(f.get("name")).trim(),description:String(f.get("description")||""),category:f.get("category"),gender:f.get("gender"),retail_price:Number(f.get("price")),wholesale_price:Number(f.get("wholesalePrice")),wholesale_min:Number(f.get("wholesaleMin")||1),image_url:vars[0].image||null,featured:f.has("featured"),is_active:f.has("active"),updated_at:new Date().toISOString()});
  if(r.error)throw r.error;
  r=await sb.from("product_sizes").delete().eq("product_id",id);if(r.error)throw r.error;
  r=await sb.from("product_variants").delete().eq("product_id",id);if(r.error)throw r.error;
  const vrows=vars.map((v,n)=>({id:uuid(),product_id:id,color_name:v.color.trim(),image_url:v.image||null,sort_order:n}));
  r=await sb.from("product_variants").insert(vrows);if(r.error)throw r.error;
  const srows=[];vars.forEach((v,n)=>Object.entries(v.sizes).forEach(([z,q])=>srows.push({product_id:id,variant_id:vrows[n].id,size_label:z,stock:Number(q)||0})));
  r=await sb.from("product_sizes").insert(srows);if(r.error)throw r.error;
  await loadData();resetProductForm();renderAdmin();toast("تم حفظ المنتج");
 }catch(err){toast("تعذر الحفظ: "+(err.message||err))}
 btn.disabled=false;
};
function editProduct(id){
 let p=products.find(x=>x.id===id),f=$("#productForm");
 Object.entries({id:p.id,name:p.name,price:p.price,wholesalePrice:p.wholesalePrice,wholesaleMin:p.wholesaleMin,category:p.category,gender:p.gender,description:p.description}).forEach(([k,v])=>f.elements[k].value=v);
 f.elements.featured.checked=p.featured;f.elements.active.checked=p.active;
 fv=p.variants.map(v=>({color:v.color==="متاح"&&!v.id?"":v.color,image:v.image||"",set:detectSet(v.sizes),sizes:{...v.sizes},busy:false}));
 renderVariantBuilder();$("#productsTab").scrollIntoView({block:"start"});
}
async function deleteProduct(id){
 if(!confirm("حذف المنتج نهائياً؟"))return;
 try{
  let r=await sb.from("product_sizes").delete().eq("product_id",id);if(r.error)throw r.error;
  r=await sb.from("product_variants").delete().eq("product_id",id);if(r.error)throw r.error;
  r=await sb.from("products").delete().eq("id",id);if(r.error)throw r.error;
  await loadData();renderAdmin();toast("تم الحذف");
 }catch(err){toast("تعذر الحذف: "+(err.message||err))}
}
async function loadOrders(){
 if(!sb)return;const {data,error}=await sb.from("orders").select("*").order("created_at",{ascending:false}).limit(100);
 adminOrders=error?[]:data;
}
function renderAdmin(){
 $("#adminProducts").innerHTML=products.map(p=>`<div class="admin-list"><span>${esc(p.name)}${p.active?"":" (مخفي)"} — قطاعي ${money(p.price)} / جملة ${money(p.wholesalePrice)} — مخزون ${stock(p)}</span><span><button onclick="editProduct('${p.id}')">تعديل</button><button onclick="deleteProduct('${p.id}')">حذف</button></span></div>`).join("")||'<p class="muted">لا توجد منتجات بعد. أضيفي أول منتج من النموذج.</p>';
 $("#adminOrders").innerHTML=adminOrders.length?adminOrders.map(o=>`<div class="admin-list"><span><b>${esc(o.order_number)}</b> · ${esc(o.customer_name)} · ${money(o.total)}<br>${new Date(o.created_at).toLocaleString("ar-EG")}</span><span><select onchange="setOrderStatus('${o.id}',this.value)">${Object.entries(STATUS_AR).map(([k,l])=>`<option value="${k}" ${o.status===k?"selected":""}>${l}</option>`).join("")}</select><button onclick="printOrder('${o.id}')">طباعة</button></span></div>`).join(""):'<p class="muted">لا توجد طلبات مسجلة بعد. الطلبات تصلك أساساً على واتساب.</p>';
 $("#whatsappNumber").value=settings.whatsapp;
}
async function setOrderStatus(id,status){const {error}=await sb.from("orders").update({status}).eq("id",id);toast(error?"تعذر تحديث الحالة":"تم تحديث الحالة")}
function printOrder(id){
 let o=adminOrders.find(x=>x.id===id);if(!o)return;let w=window.open("","_blank");
 w.document.write(`<html dir="rtl"><meta charset="utf-8"><title>طلب ${esc(o.order_number)}</title><body style="font-family:Arial;padding:30px"><h2>FamilyStore — ${esc(o.order_number)}</h2><p>${esc(o.customer_name)} | ${esc(o.phone)}</p><p>${esc(o.governorate)} - ${esc(o.area)} - ${esc(o.address)}</p><hr><pre style="font-family:Arial;white-space:pre-wrap">${esc(o.notes)}</pre><hr><p>المنتجات: ${money(o.subtotal)}</p><p>الشحن: ${money(o.shipping_cost)}</p><h3>الإجمالي: ${money(o.total)}</h3><p>الدفع عند الاستلام</p><script>window.print()<\/script></body></html>`);w.document.close();
}
$("#exportOrders").onclick=()=>{
 let rows=[["رقم الطلب","التاريخ","الاسم","الموبايل","المحافظة","الإجمالي","الحالة"],...adminOrders.map(o=>[o.order_number,new Date(o.created_at).toLocaleString("ar-EG"),o.customer_name,o.phone,o.governorate,o.total,STATUS_AR[o.status]||o.status])];
 let csv="\ufeff"+rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n");
 let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download="FamilyStore-orders.csv";a.click();
};
$("#saveSettings").onclick=async()=>{
 const n=$("#whatsappNumber").value.replace(/\D/g,"");
 const {error}=await sb.from("store_settings").upsert({key:"public_contact",value:{whatsapp:n},updated_at:new Date().toISOString()});
 if(error)return toast("تعذر حفظ الإعدادات");settings.whatsapp=n;toast("تم حفظ الإعدادات");
};

$("#year").textContent=new Date().getFullYear();
renderCart();
Promise.all([loadData(),loadSettings()]);
