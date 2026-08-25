(function () {
  const currencies={INR:{symbol:'₹',name:'Indian Rupee',rate:1},USD:{symbol:'$',name:'US Dollar',rate:0.0118},EUR:{symbol:'€',name:'Euro',rate:0.0108},GBP:{symbol:'£',name:'British Pound',rate:0.0093},AED:{symbol:'د.إ',name:'UAE Dirham',rate:0.0434},CAD:{symbol:'C$',name:'Canadian Dollar',rate:0.0160},AUD:{symbol:'A$',name:'Australian Dollar',rate:0.0182}};
  const key='billorecloud_currency'; function current(){return currencies[localStorage.getItem(key)]?localStorage.getItem(key):'INR';}
  function format(n){const c=currencies[current()];const value=Number(n||0)*c.rate;return c.symbol+value.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}
  function render(){const c=current();document.querySelectorAll('.bc-currency-select').forEach(s=>{if(s.value!==c)s.value=c;});document.querySelectorAll('[data-price-inr]').forEach(el=>{el.textContent=format(el.dataset.priceInr);});document.querySelectorAll('[data-price-label-inr]').forEach(el=>{el.textContent=format(el.dataset.priceLabelInr);});}
  window.BilloreCurrency={currencies,format,set:function(c){if(!currencies[c])return;localStorage.setItem(key,c);render();}};
  document.addEventListener('change',function(e){if(e.target.classList.contains('bc-currency-select'))window.BilloreCurrency.set(e.target.value);});
  document.addEventListener('DOMContentLoaded',render);
})();
