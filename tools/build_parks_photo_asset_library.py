#!/usr/bin/env python3
"""Build a dry-run Parks Apparel photo asset library.

Read-only: this script only runs Admin GraphQL queries when Shopify credentials are
provided and never runs mutations. If the alt-text plan CSV is missing, it falls
back to a read-only ACTIVE products media query and still queries all Shopify
Files images for unattached/orphaned assets.
"""
from __future__ import annotations

import argparse, csv, json, os, re, sys, time, urllib.request
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

MAIN_COLUMNS = [
    'photo_asset_id','shopify_file_id','shopify_media_id','shopify_product_id','product_handle','product_title','product_status','vendor','tags','image_slot',
    'image_url','preview_image_url','original_source_url','current_filename','recommended_internal_filename',
    'image_width','image_height','media_status','file_status','media_content_type','file_alt_text','current_alt_text','new_alt_text','image_type_tag',
    'featured_park_or_place','featured_design_subject','visible_text_on_design','product_type','detected_product_color','detected_background_color',
    'photo_type','photo_angle','has_model','is_lifestyle','is_mockup','is_flatlay','is_detail_shot','is_front_print','is_back_print',
    'matched_to_alt_text_plan','active_reference_source','attached_to_active_product','is_attached_to_active_product','match_method','attached_status_source',
    'search_labels','confidence_score','visual_classification_status','visual_notes','source_batch_file','row_key','needs_review','review_reason','status'
]
PARKS = ['acadia','arches','badlands','big-bend','bryce-canyon','canyonlands','capitol-reef','carlsbad-caverns','crater-lake','denali','everglades','glacier','grand-canyon','grand-teton','great-basin','great-smoky-mountains','joshua-tree','mammoth-cave','mount-rainier','olympic','redwood','rocky-mountain','sequoia','shenandoah','theodore-roosevelt','voyageurs','yellowstone','yosemite','zion']
SUBJECTS = ['bison','bear','wolf','moose','marmot','mountain-lion','elk','bird','loon','half-dome','el-capitan','old-faithful','waterfall','mountain','canyon','forest','cave','river','lake','aurora-borealis','topographic-map','park-sign','embroidered-sign','line-art','wood-sign','retro-graphic','national-park-text','quote','logo']
PRODUCT_PATTERNS = [('full-zip-hoodie', ['full zip','full-zip']),('fleece-pullover',['fleece pullover']),('five-panel-hat',['five panel','5-panel']),('trucker-hat',['trucker']),('camp-mug',['camp mug']),('water-bottle',['water bottle']),('pint-glass',['pint glass']),('t-shirt',['t-shirt','tee shirt',' tee','shirt']),('sweatshirt',['sweatshirt','crewneck']),('hoodie',['hoodie']),('beanie',['beanie']),('hat',['hat','cap']),('tumbler',['tumbler']),('mug',['mug']),('towel',['towel']),('candle',['candle'])]
COLORS = [('heather-grey',['heather grey','heather-gray']),('forest-green',['forest green']),('light-blue',['light blue']),('black',['black']),('white',['white']),('navy',['navy']),('charcoal',['charcoal']),('grey',['grey','gray']),('green',['green']),('olive',['olive']),('sand',['sand']),('cream',['cream','ivory']),('brown',['brown']),('red',['red']),('blue',['blue']),('pink',['pink'])]
NON_APPAREL={'mug','camp-mug','tumbler','water-bottle','pint-glass','towel','candle'}

def slug(s: str) -> str:
    return re.sub(r'-+','-',re.sub(r'[^a-z0-9]+','-',str(s).lower())).strip('-')
def filename_from_url(url: str) -> str:
    return Path(urlparse(url).path).name if url else ''
def text(row: dict[str,str]) -> str:
    keys=['product_handle','product_title','current_alt_text','new_alt_text','image_type_tag','source_batch_file','current_filename','file_alt_text','vendor','tags']
    return ' '.join(str(row.get(k,'') or '') for k in keys).lower().replace('_','-')
def first_match(t: str, items: list[str], suffix='') -> str:
    st=slug(t)
    for x in items:
        if x in st or x.replace('-',' ') in t:
            return f'{x}{suffix}'
    return 'unknown'
def classify(row: dict[str,str]) -> dict[str,str]:
    t=text(row); out={}
    park=first_match(t,PARKS,'-national-park')
    if 'national park' in t and park=='unknown': park='national-parks-general'
    out['featured_park_or_place']=park
    subj=first_match(t,SUBJECTS)
    if subj=='unknown' and park!='unknown': subj='national-park-text' if 'text' in t or 'word' in t else 'retro-graphic'
    out['featured_design_subject']=subj
    ptype='unknown'
    for val, pats in PRODUCT_PATTERNS:
        if any(p in t for p in pats): ptype=val; break
    out['product_type']=ptype
    color='not-apparel' if ptype in NON_APPAREL else 'unknown'
    for val,pats in COLORS:
        if any(p in t for p in pats): color=val; break
    out['detected_product_color']=color
    bg='unknown-background'
    if any(x in t for x in ['mockup','mock-up']): bg='mockup-background'
    elif 'transparent' in t: bg='transparent-background'
    elif 'flat lay' in t or 'flatlay' in t: bg='flatlay-background'
    elif 'model' in t: bg='model-background'
    elif any(x in t for x in ['outdoor','trail','forest','nature']): bg='nature-background'
    elif 'white' in t: bg='white-background'
    elif 'black' in t: bg='black-background'
    elif 'grey' in t or 'gray' in t: bg='grey-background'
    out['detected_background_color']=bg
    photo='mockup' if 'mockup' in t or 'mock-up' in t else 'product-photo'
    if 'lifestyle' in t: photo='lifestyle'
    elif 'model' in t: photo='model'
    elif 'flatlay' in t or 'flat lay' in t: photo='flat-lay'
    elif 'detail' in t or 'closeup' in t: photo='detail'
    out['photo_type']=photo
    angle='unknown'
    for a in ['front','back','side','detail']:
        if a in t: angle=a; break
    if angle=='unknown' and photo in ['lifestyle','flat-lay']: angle=photo
    out['photo_angle']=angle
    out['has_model']='yes' if photo=='model' else 'no'; out['is_lifestyle']='yes' if photo=='lifestyle' else 'no'; out['is_mockup']='yes' if photo=='mockup' else 'no'; out['is_flatlay']='yes' if photo=='flat-lay' else 'no'; out['is_detail_shot']='yes' if photo=='detail' else 'no'; out['is_front_print']='yes' if angle=='front' else 'no'; out['is_back_print']='yes' if angle=='back' else 'no'
    unknowns=sum(1 for k in ['featured_park_or_place','featured_design_subject','product_type','detected_product_color','detected_background_color','photo_angle'] if out[k].startswith('unknown'))
    out['confidence_score']=f'{max(.35,.88-.09*unknowns):.2f}'; out['visible_text_on_design']=''; out['visual_classification_status']='no-vision-available'; out['visual_notes']='Rule-based classification from CSV/Shopify metadata; no image vision model used.'
    return out

def gql_request(shop, token, query, variables):
    url=f'https://{shop}/admin/api/2026-04/graphql.json'
    req=urllib.request.Request(url, data=json.dumps({'query':query,'variables':variables}).encode(), headers={'Content-Type':'application/json','X-Shopify-Access-Token':token})
    with urllib.request.urlopen(req, timeout=60) as r: return json.load(r)

def fetch_active_product_media(shop, token):
    q='''query ActiveProducts($cursor:String){ products(first:50, after:$cursor, query:"status:ACTIVE") { pageInfo { hasNextPage endCursor } nodes { id handle title status productType vendor tags media(first:250) { nodes { id alt mediaContentType status preview { image { url width height } } ... on MediaImage { image { id url width height originalSrc } } } } } } }'''
    cur=None; rows=[]
    while True:
        data=gql_request(shop,token,q,{'cursor':cur})
        if data.get('errors'): raise RuntimeError(data['errors'])
        products=data['data']['products']
        for product in products['nodes']:
            for idx, media in enumerate(((product.get('media') or {}).get('nodes') or []), start=1):
                img=(media.get('image') or {}); prev=((media.get('preview') or {}).get('image') or {})
                url=img.get('url') or prev.get('url') or ''
                rows.append({'shopify_media_id':media.get('id',''),'shopify_product_id':product.get('id',''),'product_handle':product.get('handle',''),'product_title':product.get('title',''),'product_status':product.get('status',''),'product_type':product.get('productType',''),'vendor':product.get('vendor',''),'tags':'|'.join(product.get('tags') or []),'image_slot':f'{idx:02d}','image_url':url,'preview_image_url':prev.get('url',''),'original_source_url':img.get('originalSrc',''),'current_filename':filename_from_url(url),'current_alt_text':media.get('alt',''),'media_status':media.get('status',''),'media_content_type':media.get('mediaContentType',''),'image_width':img.get('width') or prev.get('width') or '','image_height':img.get('height') or prev.get('height') or '','matched_to_alt_text_plan':'no','active_reference_source':'shopify-active-products-query'})
        if not products['pageInfo']['hasNextPage']: break
        cur=products['pageInfo']['endCursor']; time.sleep(.2)
    return rows

def fetch_files(shop, token):
    q='''query Files($cursor:String){ files(first:100, after:$cursor, query:"media_type:IMAGE") { pageInfo { hasNextPage endCursor } nodes { id alt createdAt updatedAt fileStatus preview { image { url width height } } ... on MediaImage { image { id url width height originalSrc } } } } }'''
    cur=None; rows=[]
    while True:
        data=gql_request(shop,token,q,{'cursor':cur})
        if data.get('errors'): raise RuntimeError(data['errors'])
        files=data['data']['files']
        for n in files['nodes']:
            img=(n.get('image') or {}); prev=((n.get('preview') or {}).get('image') or {})
            url=img.get('url') or prev.get('url') or ''
            rows.append({'shopify_file_id':n.get('id',''),'shopify_media_id':n.get('id',''),'image_url':url,'preview_image_url':prev.get('url',''),'original_source_url':img.get('originalSrc',''),'current_filename':filename_from_url(url),'file_alt_text':n.get('alt',''),'created_at':n.get('createdAt',''),'updated_at':n.get('updatedAt',''),'image_width':img.get('width') or prev.get('width') or '', 'image_height':img.get('height') or prev.get('height') or '', 'file_status':n.get('fileStatus',''),'media_content_type':'IMAGE'})
        if not files['pageInfo']['hasNextPage']: break
        cur=files['pageInfo']['endCursor']; time.sleep(.2)
    return rows

def read_csv(p):
    with open(p,newline='',encoding='utf-8-sig') as f: return list(csv.DictReader(f))
def write_csv(p, rows, cols):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    with open(p,'w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=cols,extrasaction='ignore'); w.writeheader(); w.writerows(rows)

def indexes(rows):
    by_media={}; by_url={}; by_file={}
    for r in rows:
        if r.get('shopify_media_id') or r.get('media_id'): by_media[r.get('shopify_media_id') or r.get('media_id')]=r
        if r.get('image_url'): by_url[r['image_url'].split('?')[0]]=r
        fn=r.get('current_filename') or filename_from_url(r.get('image_url',''))
        if fn: by_file[fn]=r
    return by_media, by_url, by_file

def add_row(out, seq, src, files_idx, from_plan):
    by_media, by_url, by_file = files_idx
    base={k:'' for k in MAIN_COLUMNS}; base['photo_asset_id']=f'PA-{seq:06d}'
    if from_plan:
        base.update({'shopify_media_id':src.get('media_id',''),'shopify_product_id':src.get('product_id',''),'product_handle':src.get('product_handle',''),'product_title':src.get('product_title',''),'image_slot':src.get('image_slot',''),'current_alt_text':src.get('current_alt_text',''),'new_alt_text':src.get('new_alt_text',''),'image_type_tag':src.get('image_type_tag',''),'source_batch_file':src.get('source_batch_file',''),'row_key':src.get('row_key',''),'matched_to_alt_text_plan':'yes','active_reference_source':'alt-text-plan-csv','attached_to_active_product':'yes','is_attached_to_active_product':'yes','match_method':'media_id','attached_status_source':'inferred-from-active-alt-text-plan'})
    else:
        base.update({k:src.get(k,'') for k in base}); base.update({'matched_to_alt_text_plan':'no','active_reference_source':src.get('active_reference_source','shopify-active-products-query'),'attached_to_active_product':'yes','is_attached_to_active_product':'yes','match_method':'media_id','attached_status_source':'shopify-active-products-query'})
    f=by_media.get(base.get('shopify_media_id','')) or by_url.get((base.get('image_url') or '').split('?')[0]) or by_file.get(base.get('current_filename','')) or {}
    if f:
        if not by_media.get(base.get('shopify_media_id','')): base['match_method']='image_url' if by_url.get((base.get('image_url') or '').split('?')[0]) else 'filename'
        for k in ['shopify_file_id','image_url','preview_image_url','original_source_url','current_filename','image_width','image_height','file_status','media_content_type','file_alt_text']:
            base[k]=base.get(k) or f.get(k,'')
        base['media_status']=base.get('media_status') or f.get('media_status') or f.get('file_status','')
    out.append(base)

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--input',default='/mnt/data/shopify_alt_text_final_update_plan_DRY_RUN_COMPLETE_chunks_001_to_111.csv'); ap.add_argument('--out-dir',default='/mnt/data'); ap.add_argument('--shop',default=os.getenv('SHOPIFY_SHOP') or os.getenv('SHOPIFY_STORE_DOMAIN','')); ap.add_argument('--token',default=os.getenv('SHOPIFY_ADMIN_ACCESS_TOKEN','')); ap.add_argument('--files-json',default=''); ap.add_argument('--active-products-json',default='')
    a=ap.parse_args(); inp=Path(a.input)
    if a.files_json: files=json.load(open(a.files_json))
    elif a.shop and a.token: files=fetch_files(a.shop,a.token)
    else: files=[]
    files_idx=indexes(files)
    plan=[]; active=[]; reference_source='alt-text-plan-csv'
    if inp.exists(): plan=read_csv(inp)
    else:
        reference_source='shopify-active-products-query'
        if a.active_products_json: active=json.load(open(a.active_products_json))
        elif a.shop and a.token: active=fetch_active_product_media(a.shop,a.token)
        else: sys.exit(f'Input CSV not found and Shopify credentials unavailable for fallback: {inp}')
    out=[]; seq=1; active_media=set(); active_urls=set(); active_files=set()
    for r in plan:
        add_row(out,seq,r,files_idx,True); seq+=1
    for r in active:
        add_row(out,seq,r,files_idx,False); seq+=1
    for r in out:
        if r.get('shopify_media_id'): active_media.add(r['shopify_media_id'])
        if r.get('image_url'): active_urls.add(r['image_url'].split('?')[0])
        if r.get('current_filename'): active_files.add(r['current_filename'])
    for f in files:
        mid=f.get('shopify_media_id',''); url=(f.get('image_url') or '').split('?')[0]; fn=f.get('current_filename') or filename_from_url(f.get('image_url',''))
        matched = (mid and mid in active_media) or (url and url in active_urls) or (fn and fn in active_files)
        if matched: continue
        base={k:'' for k in MAIN_COLUMNS}; base.update({k:f.get(k,'') for k in base}); base['photo_asset_id']=f'PA-{seq:06d}'; base['matched_to_alt_text_plan']='no'; base['active_reference_source']=reference_source; base['attached_to_active_product']=base['is_attached_to_active_product']='no'; base['match_method']='unmatched'; base['attached_status_source']='shopify-files-unmatched-to-active-reference'; out.append(base); seq+=1
    for r in out:
        r.update(classify(r)); reasons=[]
        ext=''.join(Path(r.get('current_filename','')).suffixes[-1:])
        parts=[r['featured_park_or_place'],r['featured_design_subject'],r['product_type'],r['detected_product_color'],r['detected_background_color'],r['photo_type'],str(r.get('image_slot') or 'file')]
        fn='_'.join(slug(part) for part in parts) + ext
        if len(fn)>180: fn='_'.join(slug(part) for part in parts[:-2]+parts[-1:])[:180]; reasons.append('long-filename-shortened')
        r['recommended_internal_filename']=fn
        for cond,reason in [(not r.get('shopify_media_id'),'missing-media-id'),(not r.get('image_url'),'missing-image-url'),(r['featured_park_or_place']=='unknown','unknown-park'),(r['featured_design_subject']=='unknown','unknown-design-subject'),(r['product_type']=='unknown','unknown-product-type'),(r['detected_product_color']=='unknown','unknown-color'),(r['detected_background_color']=='unknown-background','unknown-background'),(r['photo_type']=='unknown','unknown-photo-type'),(r['photo_angle']=='unknown','unknown-photo-angle'),(float(r['confidence_score'])<.70,'low-confidence')]:
            if cond: reasons.append(reason)
        labels=[f"park-{r['featured_park_or_place']}",f"design-{r['featured_design_subject']}",f"type-{r['product_type']}",f"color-{r['detected_product_color']}",f"bg-{r['detected_background_color']}",f"photo-{r['photo_type']}",f"angle-{r['photo_angle']}",f"model-{r['has_model']}",f"lifestyle-{r['is_lifestyle']}",f"mockup-{r['is_mockup']}",f"flatlay-{r['is_flatlay']}",f"detail-{r['is_detail_shot']}"]
        r['search_labels']='|'.join(labels); r['status']='dry_run_photo_asset_library_only'; r['needs_review']='yes' if reasons else 'no'; r['review_reason']='|'.join(dict.fromkeys(reasons))
    counts=Counter(r['recommended_internal_filename'] for r in out)
    for r in out:
        if counts[r['recommended_internal_filename']]>1:
            r['needs_review']='yes'; r['review_reason']='|'.join(filter(None,[r['review_reason'],'duplicate-filename']))
    od=Path(a.out_dir); mainp=od/'parks_apparel_photo_asset_library_enriched_seed.csv'; reviewp=od/'parks_apparel_photo_asset_library_review_queue.csv'; sump=od/'parks_apparel_photo_asset_library_summary.csv'; valp=od/'parks_apparel_photo_asset_library_validation.csv'
    write_csv(mainp,out,MAIN_COLUMNS); write_csv(reviewp,[r for r in out if r['needs_review']=='yes'],MAIN_COLUMNS)
    summary={'total_rows':len(out),'unique_media_ids':len({r['shopify_media_id'] for r in out if r['shopify_media_id']}),'unique_product_handles':len({r['product_handle'] for r in out if r['product_handle']}),'rows_with_image_url':sum(bool(r['image_url']) for r in out),'rows_missing_image_url':sum(not r['image_url'] for r in out),'rows_needing_review':sum(r['needs_review']=='yes' for r in out),'duplicate_recommended_filenames':sum(1 for c in counts.values() if c>1),'unknown_park_count':sum(r['featured_park_or_place']=='unknown' for r in out),'unknown_design_subject_count':sum(r['featured_design_subject']=='unknown' for r in out),'unknown_product_type_count':sum(r['product_type']=='unknown' for r in out),'unknown_color_count':sum(r['detected_product_color']=='unknown' for r in out),'unknown_background_count':sum(r['detected_background_color']=='unknown-background' for r in out),'unknown_photo_type_count':sum(r['photo_type']=='unknown' for r in out),'low_confidence_count':sum(float(r['confidence_score'])<.70 for r in out),'visual_title_conflict_count':0,'live_shopify_updates_applied':0,'status':'dry_run_photo_asset_library_only'}
    write_csv(sump,[summary],list(summary))
    input_count=len(plan) if plan else len(active)
    validations=[('active reference source',reference_source),('input row count',input_count),('output row count',len(out)),('input/output row count match','yes' if len(out)>=input_count else 'no'),('blank photo_asset_id count',sum(not r['photo_asset_id'] for r in out)),('blank shopify_media_id count',sum(not r['shopify_media_id'] for r in out)),('blank image_url count',summary['rows_missing_image_url']),('duplicate shopify_media_id count',sum(c-1 for c in Counter(r['shopify_media_id'] for r in out if r['shopify_media_id']).values() if c>1)),('duplicate recommended filename count',summary['duplicate_recommended_filenames']),('rows needing review',summary['rows_needing_review']),('live Shopify mutations run',0),('alt text changed','no'),('filenames changed','no'),('products changed','no')]
    write_csv(valp,[{'check':k,'value':v} for k,v in validations],['check','value'])
    print(json.dumps({'created':[str(mainp),str(reviewp),str(sump),str(valp)], 'active_reference_source':reference_source, **summary}, indent=2))
if __name__=='__main__': main()
