// Paginate the already authorized in-memory snapshot; no extra requests per page.
export const ADMIN_PAGE_SIZE=50;
export function pageWindow(rows,page=0,size=ADMIN_PAGE_SIZE){
 const count=rows.length;
 const pages=Math.max(1,Math.ceil(count/size));
 const current=Math.min(pages-1,Math.max(0,Number.isInteger(page)?page:0));
 const start=current*size,end=Math.min(start+size,count);
 return {rows:rows.slice(start,end),page:current,pages,start:count?start+1:0,end,count};
}
