const e=r=>{const t=r.trim();return t?/^(https?:)?\/\//i.test(t)?t:`https://${t}`:""},n=r=>{try{return new URL(e(r)),!0}catch{return!1}};export{n as i,e as n};
