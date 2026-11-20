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
/* ============ استيراد منتجات من Excel / CSV ============ */
(function(){
 const XLSX_URL="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
 let xp=null;
 const loadXlsx=()=>window.XLSX?Promise.resolve():(xp=xp||new Promise((res,rej)=>{const s=document.createElement("script");s.src=XLSX_URL;s.onload=res;s.onerror=()=>{xp=null;rej(new Error("تعذر تحميل مكتبة Excel. جرّبي حفظ الملف بصيغة CSV."))};document.head.appendChild(s)}));
 const norm=s=>String(s??"").trim().replace(/[\u064B-\u0652]/g,"").replace(/[\s_\-]/g,"").replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").toLowerCase();
 const COLS={name:["اسمالمنتج","الاسم","name","product"],price:["سعرالقطاعي","القطاعي","سعرالبيع","price","retail"],wprice:["سعرالجمله","الجمله","wholesale","wholesaleprice"],wmin:["اقلكميهجمله","اقلكميه","الحدالادني","wholesalemin","min"],cat:["القسم","category"],gender:["النوع","الجنس","gender"],color:["اللون","color"],size:["المقاس","size"],qty:["الكميه","المخزون","qty","stock"],img:["رابطالصوره","الصوره","image","imageurl"],desc:["وصف","الوصف","description"],feat:["الاكثرمبيعا","مميز","featured"]};
 const LOOK={};Object.entries(COLS).forEach(([k,a])=>a.forEach(x=>LOOK[x]=k));
 const toNum=v=>Number(String(v??"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^\d.]/g,""));
 const CAT={baby:"Baby",بيبي:"Baby",kids:"Kids",اطفال:"Kids",طفل:"Kids",junior:"Junior",جونيور:"Junior"};
 const GEN={بناتي:"بناتي",بنات:"بناتي",girl:"بناتي",girls:"بناتي",ولادي:"ولادي",اولاد:"ولادي",ولد:"ولادي",boy:"ولادي",boys:"ولادي",مشترك:"مشترك",both:"مشترك",unisex:"مشترك"};
 function parseCSV(text){
  text=text.replace(/^\uFEFF/,"");
  const first=text.split(/\r?\n/)[0]||"";
  const d=[",",";","\t"].map(c=>[c,first.split(c).length]).sort((a,b)=>b[1]-a[1])[0][0];
  const rows=[];let row=[],cur="",q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
   if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
   else if(c==='"')q=true;
   else if(c===d){row.push(cur);cur=""}
   else if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(cur);cur="";rows.push(row);row=[]}
   else cur+=c}
  if(cur!==""||row.length){row.push(cur);rows.push(row)}
  return rows.filter(r=>r.some(x=>String(x).trim()!==""));
 }
 async function readRows(file){
  if(/\.csv$/i.test(file.name)){return parseCSV(await file.text())}
  await loadXlsx();
  const wb=XLSX.read(await file.arrayBuffer(),{type:"array"});
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:"",raw:false}).filter(r=>r.some(x=>String(x).trim()!==""));
 }
 function build(rows){
  const errors=[],map={};
  const head=rows[0]||[];head.forEach((h,i)=>{const k=LOOK[norm(h)];if(k&&!(k in map))map[k]=i});
  ["name","price","size"].forEach(k=>{if(!(k in map))errors.push("عمود ناقص: "+({name:"اسم المنتج",price:"سعر القطاعي",size:"المقاس"})[k])});
  if(errors.length)return {errors};
  const g=(r,k)=>k in map?String(r[map[k]]??"").trim():"";
  const prods=new Map();
  rows.slice(1).forEach((r,i)=>{
   const ln="سطر "+(i+2)+": ",name=g(r,"name");
   if(!name&&!g(r,"size"))return;
   if(!name)return errors.push(ln+"اسم المنتج فاضي");
   let p=prods.get(name);
   if(!p){
    const price=toNum(g(r,"price")),wp=g(r,"wprice")?toNum(g(r,"wprice")):price,wm=g(r,"wmin")?toNum(g(r,"wmin")):1;
    if(!(price>0))return errors.push(ln+"سعر القطاعي غير صحيح ("+name+")");
    const cat=CAT[norm(g(r,"cat"))];if(!cat)return errors.push(ln+"القسم غير معروف (بيبي / أطفال / جونيور)");
    const gen=g(r,"gender")?GEN[norm(g(r,"gender"))]:"مشترك";if(!gen)return errors.push(ln+"النوع غير معروف (بناتي / ولادي / مشترك)");
    p={name,price,wprice:wp>0?wp:price,wmin:wm>0?wm:1,cat,gen,desc:g(r,"desc"),feat:["نعم","yes","1","true","x","✓"].includes(norm(g(r,"feat"))),variants:new Map()};
    prods.set(name,p);
   }
   const size=g(r,"size").toUpperCase().replace(/\s+/g,"");
   if(!size)return errors.push(ln+"المقاس فاضي");
   const color=g(r,"color")||"لون واحد";
   let v=p.variants.get(color);if(!v){v={color,img:"",sizes:{}};p.variants.set(color,v)}
   const img=g(r,"img");if(img&&/^https?:\/\//i.test(img)&&!v.img)v.img=img;
   const qty=g(r,"qty")?toNum(g(r,"qty")):0;
   v.sizes[size]=(v.sizes[size]||0)+(qty>0?qty:0);
  });
  return {errors,prods:[...prods.values()]};
 }
 async function doImport(file){
  const st=$("#importStatus");
  if(!sb||!isAdmin)return toast("سجّلي دخول الإدارة أولاً");
  st.textContent="جاري قراءة الملف...";
  let res;
  try{res=build(await readRows(file))}catch(e){st.textContent="";return toast(e.message||"تعذر قراءة الملف")}
  if(res.errors.length){st.textContent="";return alert("في مشاكل في الملف:\n"+res.errors.slice(0,8).join("\n")+(res.errors.length>8?"\n...و "+(res.errors.length-8)+" مشكلة تانية":""))}
  const have=new Set(products.map(p=>p.name.trim().toLowerCase()));
  const skipped=[],list=res.prods.filter(p=>have.has(p.name.toLowerCase())?(skipped.push(p.name),false):true);
  if(!list.length){st.textContent="";return alert("كل المنتجات اللي في الملف موجودة بالفعل.")}
  const nv=list.reduce((a,p)=>a+p.variants.size,0);
  if(!confirm("هيتم إضافة "+list.length+" منتج ("+nv+" لون)."+(skipped.length?"\nهيتم تخطي الموجود بالفعل: "+skipped.join("، "):"")+"\nمتابعة؟")){st.textContent="";return}
  const prows=[],vrows=[],srows=[];
  list.forEach(p=>{const id=uuid();let n=0,first="";
   p.variants.forEach(v=>{const vid=uuid();if(!first)first=v.img;vrows.push({id:vid,product_id:id,color_name:v.color,image_url:v.img||null,sort_order:n++});Object.entries(v.sizes).forEach(([z,q])=>srows.push({product_id:id,variant_id:vid,size_label:z,stock:q}))});
   prows.push({id,name:p.name,description:p.desc,category:p.cat,gender:p.gen,retail_price:p.price,wholesale_price:p.wprice,wholesale_min:p.wmin,image_url:first||null,featured:p.feat,is_active:true,updated_at:new Date().toISOString()});});
  const ids=prows.map(p=>p.id);
  try{
   st.textContent="جاري الحفظ...";
   let r=await sb.from("products").insert(prows);if(r.error)throw r.error;
   r=await sb.from("product_variants").insert(vrows);if(r.error)throw r.error;
   r=await sb.from("product_sizes").insert(srows);if(r.error)throw r.error;
   await loadData();renderAdmin();st.textContent="";
   toast("تم استيراد "+list.length+" منتج. ضيفي الصور من زر تعديل.");
  }catch(err){
   try{await sb.from("product_sizes").delete().in("product_id",ids);await sb.from("product_variants").delete().in("product_id",ids);await sb.from("products").delete().in("id",ids)}catch(e){}
   st.textContent="";toast("تعذر الاستيراد: "+(err.message||err));
  }
 }
 async function downloadTemplate(){
  const H=["اسم المنتج","سعر القطاعي","سعر الجملة","أقل كمية جملة","القسم","النوع","اللون","المقاس","الكمية","رابط الصورة","وصف","الأكثر مبيعاً"];
  const R=[["طقم صيفي بناتي",420,330,6,"أطفال","بناتي","وردي","4Y",5,"","طقم مريح","نعم"],["طقم صيفي بناتي",420,330,6,"أطفال","بناتي","وردي","6Y",3,"","",""],["طقم صيفي بناتي",420,330,6,"أطفال","بناتي","أبيض","4Y",4,"","",""],["سالوبت بيبي",310,245,6,"بيبي","مشترك","أزرق","6M",4,"","ناعم ومناسب للبشرة الحساسة",""]];
  try{await loadXlsx();const ws=XLSX.utils.aoa_to_sheet([H,...R]),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"المنتجات");XLSX.writeFile(wb,"FamilyStore-products-template.xlsx")}
  catch(e){const csv="\uFEFF"+[H,...R].map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download="FamilyStore-products-template.csv";a.click()}
 }
 const box=document.createElement("div");box.className="admin-list";box.style.cssText="display:block;margin:12px 0";
 box.innerHTML='<b>استيراد منتجات من Excel / CSV</b><p class="muted">كل سطر = مقاس واحد للون واحد من المنتج. المنتج الموجود بنفس الاسم بيتم تخطيه. الصور بتضيفيها بعد الاستيراد من زر "تعديل".</p><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><label class="upload-btn">📥 رفع ملف Excel / CSV<input id="importFile" type="file" accept=".xlsx,.xls,.csv"></label><button type="button" class="secondary-btn" id="importTpl">تحميل نموذج</button><span class="vstatus" id="importStatus"></span></div>';
 $("#productsTab").insertBefore(box,$("#productForm"));
 $("#importFile").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(f)await doImport(f)};
 $("#importTpl").onclick=downloadTemplate;
})();
/* ============ تصدير بيانات المبيعات Excel ============ */
(function(){
 const XLSX_URL="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
 let xp=null;
 const loadXlsx=()=>window.XLSX?Promise.resolve():(xp=xp||new Promise((res,rej)=>{const s=document.createElement("script");s.src=XLSX_URL;s.onload=res;s.onerror=()=>{xp=null;rej(new Error("تعذر تحميل مكتبة Excel"))};document.head.appendChild(s)}));
 const toNum=v=>Number(String(v??"").replace(/ج\.م/g,"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^\d.]/g,""))||0;
 const LINE=/^-\s*(.+?)\s*\|\s*(.*?)\s*\|\s*(\S+)\s*×\s*(\d+)\s*\((جملة|قطاعي)\)\s*=\s*(.+)$/;
 const p2=n=>String(n).padStart(2,"0");
 const fmt=d=>{const x=new Date(d);return isNaN(x)?"":x.getFullYear()+"-"+p2(x.getMonth()+1)+"-"+p2(x.getDate())+" "+p2(x.getHours())+":"+p2(x.getMinutes())};
 async function fetchOrders(from,to){
  let q=sb.from("orders").select("*").order("created_at",{ascending:false}).limit(5000);
  if(from)q=q.gte("created_at",new Date(from+"T00:00:00").toISOString());
  if(to)q=q.lte("created_at",new Date(to+"T23:59:59").toISOString());
  const r=await q;if(r.error)throw r.error;return r.data||[];
 }
 function sheetFrom(rows,widths){const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=widths.map(w=>({wch:w}));return ws}
 function buildBook(orders){
  const st=o=>STATUS_AR[o.status]||o.status||"";
  const live=orders.filter(o=>o.status!=="cancelled");
  const head=["رقم الطلب","التاريخ","العميل","الموبايل","المحافظة","المنطقة","العنوان","نوع البيع","قيمة المنتجات","الشحن","الإجمالي","الحالة","ملاحظات العميل"];
  const A=[head],B=[["رقم الطلب","التاريخ","الحالة","المنتج","اللون","المقاس","الكمية","نوع السعر","المبلغ"]];
  const byProd={},byStatus={},byGov={};
  orders.forEach(o=>{
   const lines=String(o.notes||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
   const own=lines.filter(l=>!l.startsWith("- ")).join(" ");
   A.push([o.order_number,fmt(o.created_at),o.customer_name,o.phone,o.governorate,o.area,o.address,o.sales_type==="wholesale"?"جملة":"قطاعي",Number(o.subtotal)||0,Number(o.shipping_cost)||0,Number(o.total)||0,st(o),own]);
   lines.filter(l=>l.startsWith("- ")).forEach(l=>{
    const m=LINE.exec(l);if(!m)return;
    const [,name,color,size,qty,mode,amt]=m,a=toNum(amt);
    B.push([o.order_number,fmt(o.created_at),st(o),name,color,size,Number(qty),mode,a]);
    if(o.status!=="cancelled"){const p=byProd[name]||(byProd[name]={q:0,a:0});p.q+=Number(qty);p.a+=a}
   });
   const s=byStatus[st(o)]||(byStatus[st(o)]={n:0,t:0});s.n++;s.t+=Number(o.total)||0;
   if(o.status!=="cancelled"){const g=byGov[o.governorate||"-"]||(byGov[o.governorate||"-"]={n:0,t:0});g.n++;g.t+=Number(o.total)||0}
  });
  const sum=k=>live.reduce((a,o)=>a+(Number(o[k])||0),0);
  const S=[["ملخص المبيعات (من غير الطلبات الملغية)",""],["عدد الطلبات",live.length],["قيمة المنتجات",sum("subtotal")],["الشحن",sum("shipping_cost")],["إجمالي المبيعات",sum("total")],["متوسط قيمة الطلب",live.length?Math.round(sum("total")/live.length):0],[""],["حسب المنتج","الكمية","المبيعات"]];
  Object.entries(byProd).sort((x,y)=>y[1].a-x[1].a).forEach(([k,v])=>S.push([k,v.q,v.a]));
  S.push([""],["حسب الحالة","عدد الطلبات","الإجمالي"]);
  Object.entries(byStatus).forEach(([k,v])=>S.push([k,v.n,v.t]));
  S.push([""],["حسب المحافظة","عدد الطلبات","الإجمالي"]);
  Object.entries(byGov).sort((x,y)=>y[1].t-x[1].t).forEach(([k,v])=>S.push([k,v.n,v.t]));
  const wb=XLSX.utils.book_new();wb.Workbook={Views:[{RTL:true}]};
  XLSX.utils.book_append_sheet(wb,sheetFrom(S,[34,16,16]),"ملخص");
  XLSX.utils.book_append_sheet(wb,sheetFrom(A,[14,17,20,15,14,16,34,10,13,9,11,13,28]),"الطلبات");
  XLSX.utils.book_append_sheet(wb,sheetFrom(B,[14,17,12,26,12,9,8,10,11]),"تفاصيل المنتجات");
  return {wb,A};
 }
 const box=document.createElement("div");box.className="admin-list";box.style.cssText="display:block;margin:12px 0";
 box.innerHTML='<b>تصدير بيانات المبيعات (Excel)</b><div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0"><label>من تاريخ<input type="date" id="salesFrom"></label><label>إلى تاريخ<input type="date" id="salesTo"></label></div><button type="button" class="primary-btn" id="salesExport">📊 تحميل ملف المبيعات Excel</button><p class="muted">من غير تواريخ هيتصدر كل الطلبات. الملف فيه 3 صفحات: ملخص، الطلبات، تفاصيل المنتجات. الطلبات الملغية مش بتتحسب في الإجماليات.</p>';
 const tab=$("#ordersTab");tab.insertBefore(box,tab.children[1]||null);
 $("#salesExport").onclick=async e=>{
  if(!sb||!isAdmin)return toast("سجّلي دخول الإدارة أولاً");
  const btn=e.currentTarget;btn.disabled=true;
  try{
   const orders=await fetchOrders($("#salesFrom").value,$("#salesTo").value);
   if(!orders.length){toast("مفيش طلبات في الفترة دي");return}
   const day=new Date(),name="FamilyStore-sales-"+day.getFullYear()+"-"+p2(day.getMonth()+1)+"-"+p2(day.getDate());
   try{await loadXlsx();const {wb}=buildBook(orders);XLSX.writeFile(wb,name+".xlsx");toast("تم تحميل ملف المبيعات")}
   catch(err){
    const csv="\uFEFF"+orders.map(o=>[o.order_number,fmt(o.created_at),o.customer_name,o.phone,o.governorate,o.total,STATUS_AR[o.status]||o.status].map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download=name+".csv";a.click();toast("اتحمل CSV لأن مكتبة Excel ما اشتغلتش");
   }
  }catch(err){toast("تعذر تصدير المبيعات: "+(err.message||err))}
  btn.disabled=false;
 };
})();
/* ===== addon3: السعر قبل/بعد الخصم + شارة نسبة الخصم ===== */
(function(){
  const st=document.createElement("style");
  st.textContent=".product-image{position:relative}.disc-badge{position:absolute;top:10px;right:10px;background:#d6455d;color:#fff;font-weight:900;font-size:13px;padding:5px 11px;border-radius:20px;z-index:2;box-shadow:0 2px 6px rgba(0,0,0,.2)}.price-pair b.was{color:var(--muted);text-decoration:line-through;font-weight:600}";
  document.head.appendChild(st);
  function decorate(){
    document.querySelectorAll("#productGrid .product-card").forEach(card=>{
      if(card.dataset.disc)return;
      const ph=card.querySelector(".product-image");if(!ph)return;
      const p=products.find(x=>"photo-"+x.id===ph.id);if(!p)return;
      card.dataset.disc="1";
      const w=Number(p.wholesalePrice),r=Number(p.price);
      if(!(w>0&&r>0&&w<r))return;
      const pct=Math.round((1-w/r)*100);
      const pair=card.querySelector(".price-pair");
      if(pair)pair.innerHTML='<span>السعر قبل الخصم <b class="was">'+money(r)+'</b></span><span>السعر بعد الخصم <b>'+money(w)+'</b></span>';
      const b=document.createElement("div");b.className="disc-badge";b.textContent="خصم "+pct+"%";ph.appendChild(b);
    });
  }
  const grid=document.getElementById("productGrid");
  if(grid)new MutationObserver(decorate).observe(grid,{childList:true});
  decorate();
  document.querySelectorAll("#productForm label").forEach(l=>{
    const t=l.firstChild;if(!t||t.nodeType!==3)return;
    if(t.textContent.includes("سعر القطاعي"))t.textContent="السعر قبل الخصم – قطاعي (ج.م)";
    else if(t.textContent.includes("سعر الجملة"))t.textContent="السعر بعد الخصم – جملة (ج.م)";
  });
})();
/* ===== addon4: حذف مضمون + أسعار الشحن + متابعة الطلبات ===== */
(function(){
  const ST={new:"جديد",confirmed:"تم تأكيد الطلب",shipped:"الطلب اتشحن",delivered:"الطلب وصل",paid:"تم تحصيل المقابل",cancelled:"ملغي"};
  const COL={new:"#8a6d1d",confirmed:"#1f5f8b",shipped:"#6b3fa0",delivered:"#2b7a4b",paid:"#0d5c2e",cancelled:"#b3261e"};
  Object.keys(STATUS_AR).forEach(k=>delete STATUS_AR[k]);Object.assign(STATUS_AR,ST);

  deleteProduct=async function(id){
    if(!confirm("حذف المنتج نهائياً؟"))return;
    try{
      let r=await sb.from("product_sizes").delete().eq("product_id",id).select();if(r.error)throw r.error;
      r=await sb.from("product_variants").delete().eq("product_id",id).select();if(r.error)throw r.error;
      r=await sb.from("products").delete().eq("id",id).select();if(r.error)throw r.error;
      if(!r.data||!r.data.length)throw new Error("الصلاحيات تمنع الحذف (شغّلي ملف SQL)");
      await loadData();renderAdmin();toast("تم الحذف");
    }catch(err){toast("تعذر الحذف: "+(err.message||err))}
  };

  setOrderStatus=async function(id,status){
    const r=await sb.from("orders").update({status}).eq("id",id).select();
    if(r.error||!r.data||!r.data.length)return toast("تعذر تحديث الحالة (شغّلي ملف SQL)");
    const o=adminOrders.find(x=>x.id===id);if(o)o.status=status;
    toast("تم تحديث الحالة");renderAdmin();
  };

  let flt="all";
  const css=document.createElement("style");
  css.textContent=".ofl{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 12px}.ofl button{border:1px solid var(--line);background:#fff;border-radius:20px;padding:5px 11px;font-size:12px}.ofl button.on{background:var(--green);color:#fff}.ocard{border:1px solid var(--line);border-radius:10px;padding:11px;margin:9px 0;font-size:12px;line-height:1.8}.ocard .top{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}.ochip{color:#fff;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700}.ocard select{border:1px solid var(--line);border-radius:6px;padding:5px}.ocard details pre{white-space:pre-wrap;font-family:inherit;margin:4px 0;background:#faf8f3;padding:8px;border-radius:6px}.ocard button,.ocard a.b{border:0;background:#eee;padding:5px 10px;border-radius:6px;font-size:12px;color:var(--ink)}.shipgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.shipgrid label{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:12px;border:1px solid var(--line);border-radius:8px;padding:6px 9px}.shipgrid input{width:70px;border:1px solid var(--line);border-radius:6px;padding:4px}";
  document.head.appendChild(css);
  function ordersHTML(){
    const cnt={all:adminOrders.length};Object.keys(ST).forEach(k=>cnt[k]=adminOrders.filter(o=>(o.status||"new")===k).length);
    const bar='<div class="ofl">'+[["all","الكل"],...Object.entries(ST)].map(([k,l])=>`<button type="button" class="${flt===k?"on":""}" data-f="${k}">${l} (${cnt[k]})</button>`).join("")+"</div>";
    const list=adminOrders.filter(o=>flt==="all"||(o.status||"new")===flt);
    const cards=list.map(o=>{
      const s=o.status||"new",ph=String(o.phone||"").replace(/\D/g,""),wa=ph.startsWith("0")?"2"+ph:ph;
      return `<div class="ocard"><div class="top"><span><b>${esc(o.order_number)}</b> <span class="ochip" style="background:${COL[s]||"#666"}">${esc(ST[s]||s)}</span></span><span>${new Date(o.created_at).toLocaleString("ar-EG")}</span></div>
<div>${esc(o.customer_name)} · <a href="tel:${esc(ph)}">${esc(o.phone)}</a> · ${esc(o.governorate)} – ${esc(o.area)}</div>
<div>${esc(o.address)}</div>
<div>المنتجات ${money(o.subtotal)} + شحن ${money(o.shipping_cost)} = <b>${money(o.total)}</b></div>
<details><summary>تفاصيل المنتجات</summary><pre>${esc(o.notes)}</pre></details>
<div class="top"><select onchange="setOrderStatus('${o.id}',this.value)">${Object.entries(ST).map(([k,l])=>`<option value="${k}" ${s===k?"selected":""}>${l}</option>`).join("")}</select><span><a class="b" href="https://wa.me/${esc(wa)}" target="_blank">واتساب</a> <button type="button" onclick="printOrder('${o.id}')">طباعة</button></span></div></div>`}).join("");
    return bar+(cards||'<p class="muted">لا توجد طلبات في هذا التصنيف.</p>');
  }
  const baseRender=renderAdmin;
  renderAdmin=function(){
    baseRender();
    const box=document.getElementById("adminOrders");
    if(box){box.innerHTML=ordersHTML();box.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{flt=b.dataset.f;renderAdmin()})}
    renderShipGrid();
  };

  const DEFAULT_SHIP=Object.assign({},SHIPPING);
  function applyShip(v){
    if(!v||typeof v!=="object")return;
    Object.keys(v).forEach(k=>{const n=Number(v[k]);if(n>0&&(k in DEFAULT_SHIP))SHIPPING[k]=n});
    try{renderGovernorates();updateCheckout()}catch(e){}
  }
  async function fetchShip(){
    if(!sb)return;
    const {data}=await sb.from("store_settings").select("value").eq("key","shipping").maybeSingle();
    applyShip(data&&data.value);
  }
  const tabs=document.querySelector(".admin-tabs"),content=document.getElementById("adminContent");
  const logoutBtn=document.getElementById("adminLogout");
  const tb=document.createElement("button");tb.type="button";tb.dataset.tab="shippingTab";tb.textContent="الشحن";
  tabs.insertBefore(tb,logoutBtn);
  const sec=document.createElement("section");sec.id="shippingTab";sec.hidden=true;
  sec.innerHTML='<h3>أسعار الشحن للمحافظات</h3><p class="muted">عدّلي السعر واضغطي حفظ، والتغيير بيظهر للعملاء فوراً.</p><div id="shipGrid" class="shipgrid"></div><button class="primary-btn" id="saveShip" type="button" style="margin-top:14px">حفظ أسعار الشحن</button>';
  content.appendChild(sec);
  function renderShipGrid(){
    const g=document.getElementById("shipGrid");if(!g||g.dataset.done&&document.activeElement&&g.contains(document.activeElement))return;
    g.innerHTML=Object.keys(DEFAULT_SHIP).map(k=>`<label>${esc(k)}<input type="number" min="1" data-g="${esc(k)}" value="${SHIPPING[k]}"></label>`).join("");g.dataset.done="1";
  }
  const all=["productsTab","ordersTab","settingsTab","shippingTab"];
  document.querySelectorAll(".admin-tabs button[data-tab]").forEach(b=>b.addEventListener("click",()=>{
    all.forEach(id=>{const e=document.getElementById(id);if(e)e.hidden=id!==b.dataset.tab});
    document.querySelectorAll(".admin-tabs button[data-tab]").forEach(x=>x.classList.toggle("active",x===b));
  }));
  document.getElementById("saveShip").onclick=async()=>{
    const v={};let bad=false;
    document.querySelectorAll("#shipGrid input").forEach(i=>{const n=Number(i.value);if(!(n>0))bad=true;v[i.dataset.g]=n});
    if(bad)return toast("كل الأسعار لازم تكون أكبر من صفر");
    const r=await sb.from("store_settings").upsert({key:"shipping",value:v,updated_at:new Date().toISOString()}).select();
    if(r.error||!r.data||!r.data.length)return toast("تعذر الحفظ (شغّلي ملف SQL)");
    applyShip(v);toast("تم حفظ أسعار الشحن");
  };
  fetchShip();
})();
/* ===== addon5: كل لون يظهر لوحده في الصفحة الرئيسية ===== */
(function(){
  const st=document.createElement("style");
  st.textContent=".color-tag{display:inline-block;background:#f4efe6;color:var(--green);font-size:12px;font-weight:800;padding:3px 11px;border-radius:20px;margin:2px 0 4px}";
  document.head.appendChild(st);
  renderProducts=function(){
    const list=visibleProducts().filter(p=>(!activeCategory||p.category===activeCategory)&&(activeFilter==="الكل"||(activeFilter==="الأكثر مبيعاً"?p.featured:p.gender===activeFilter)));
    const cards=[];
    list.forEach(p=>p.variants.forEach((v,i)=>{
      const k=p.id+"-"+i,img=v.image||p.image,w=Number(p.wholesalePrice),r=Number(p.price);
      const disc=w>0&&r>0&&w<r;
      const price=disc
        ?'<span>السعر قبل الخصم <b style="color:var(--muted);text-decoration:line-through;font-weight:600">'+money(r)+'</b></span><span>السعر بعد الخصم <b>'+money(w)+'</b></span>'
        :'<span>قطاعي <b>'+money(r)+'</b></span><span>جملة <b>'+money(w||r)+'</b></span>';
      const badge=disc?'<div class="disc-badge">خصم '+Math.round((1-w/r)*100)+'%</div>':"";
      const col=v.color&&v.color!=="متاح"?'<div class="color-tag">اللون: '+esc(v.color)+'</div>':"";
      cards.push('<article class="product-card"><div class="product-image" id="photo-'+k+'">'+(img?'<img src="'+esc(img)+'" alt="'+esc(p.name+" "+(v.color||""))+'" onerror="this.remove()">':'<span class="placeholder">✿</span>')+badge+'</div><div class="product-info"><small>'+esc(p.category)+' · '+esc(p.gender)+'</small><h3>'+esc(p.name)+'</h3>'+col+'<div class="price-pair">'+price+'</div><label>المقاس<select id="size-'+k+'">'+sizeOptions(v)+'</select></label><button class="add-btn" onclick="addToCart(\''+p.id+'\','+i+')">أضيفي للسلة</button></div></article>');
    }));
    $("#productGrid").innerHTML=cards.length?cards.join(""):'<div class="empty">لا توجد منتجات في هذا القسم حالياً.</div>';
  };
  addToCart=function(id,vi){
    vi=Number(vi||0);
    const p=products.find(x=>x.id===id),v=p.variants[vi],size=$("#size-"+id+"-"+vi).value;
    if(!size||!(v.sizes[size]>0))return toast("المقاس غير متاح");
    let item=cart.find(x=>x.id===id&&x.size===size&&x.colorIndex===vi&&x.mode===priceMode);
    if(item){if(item.qty>=v.sizes[size])return toast("الكمية المطلوبة غير متاحة");item.qty++}
    else cart.push({id,size,colorIndex:vi,color:v.color,qty:1,mode:priceMode});
    saveCart();renderCart();toast("تمت الإضافة للسلة");
  };
  if(products.length)renderProducts();
})();
