(function() {

if (!('defineProperty' in Object) && !('__defineSetter__' in Object) || !('JSON' in window)) {
   var s = document.getElementsByTagName('script')
   for (var i = 0; i < s.length; i++) {
      if (s[i].src.match(/(^|\/)autosync.js$/)) {
         s[i].src = s[i].src.replace(/autosync(-min)?.js$/, 'autosync-compat$1.js')
      }
   }
   return
}
   
window.as = {
   hooks: { before: {}, after: {} },
   hints: {},
   add: function(module, scope, key, atomic, val) {
      if (!scope) scope = window;
      var _scope = scope;
      if (_scope.toString() == _scope) {
         scope = eval(scope);
      }
      if (!val && scope[module]) {
         val = scope[module]
      }
      if (scope == window && !document.all) {
         delete scope[module];
      }
      var self = this;
      
      if (atomic === null || atomic === undefined) {
         atomic = templatesPresent(module, scope, key)
      }
      
      createProxy(val, module, _scope, scope, atomic ? module : null, key)
      
      scope[module] = val;
      return this;
   },
   remove: function(module, scope, unset) {
      if (!scope) scope = window;
      var _scope = scope;
      if (_scope.toString() == _scope) {
         scope = eval(scope);
      }
      var val = scope[module];
      delete scope[module];
      if (!unset) scope[module] = val;
      return this;
   },
   pull: function(module, scope, update, url, key) {
      if (!scope) scope = window;
      var _scope = scope;
      if (_scope.toString() == _scope) {
         scope = eval(scope);
      }
      var data = scope[module.split('.')[0]];
      var els = document.querySelectorAll ? document.querySelectorAll('[asmodel^="' + module + '"]') : document.getElementsByTagName('*');
      for (var i = 0; i < els.length; i++) {
         if (!els[i].tagName.toLowerCase().match(/^(textarea|input)$/)) continue;
         var prop = els[i].getAttribute('asmodel');
         if (prop.match(new RegExp('^' + module + '[a-z0-9$@#_-]', 'i'))) continue;
         
         var el_scope = els[i].getAttribute('asscope')
         if (_scope.toString() == _scope && el_scope !== null && el_scope != _scope) continue;
         
         if (key != null) {
            var el_key = els[i].getAttribute('askey')
            if (el_key != null && el_key != key && el_key != '*') continue
         }
         
         var s = prop.split('.');
         var val = data;
         for (var j = 1; j < s.length; j++) {
            var is_valid = val instanceof Object && !!s[j].match(/^[a-z][a-z0-9$@#_-]*$/i) ||
                           val instanceof Array && !isNaN(parseInt(s[j]));
            val = is_valid && j < s.length-1 ? val[s[j]] : val;
            if (val == undefined || !is_valid) break;
         }
         var new_val = els[i].type == 'checkbox' || els[i].type == 'radio' ? els[i].checked : els[i].value
         if (new_val.match(/^-?[0-9]+$/)) new_val = parseInt(new_val)
         else if (new_val.match(/^-?[0-9]+(\.[0-9]+)?$/)) new_val = parseFloat(new_val)
         if (els[i].getAttribute('asjson') !== false) {
            try { new_val = JSON.parse(new_val) } catch(ex) { console.log(ex) }
         }
         if (s.length > 1) val[s[s.length-1]] = new_val;
         else scope[module] = new_val;
         if (url) {
            send(url, new_val)
         }
         if (update) {
            render(module, _scope, key)
         }
      }
   },
   update: function(module, scope, key) {
      render(module, scope, key)
   },
   setBefore: function(model, func) {
      this.hooks.before[model] = func
   },
   setAfter: function(model, func) {
      this.hooks.after[model] = func
   }
}

function createProxy(val, module, _scope, scope, root, key) {

   var value = val, _sc = _scope, sc = scope, render_root = root || module, mkey = key
   
   if ('defineProperty' in Object) {
      Object.defineProperty(sc, module.split('.').pop(), {
      
         get: function(){
            return value;
         },

         set: function(val){
            value = val;
            
            var func = as.hooks.before[module];
            if (func && func instanceof Function) func(val);
            
            render(render_root, _sc, mkey);
            
            func = as.hooks.after[module];
            if (func && func instanceof Function) func(val);
         },

         configurable: true
      });
   } else if ('__defineSetter__' in scope) {
      scope.__defineSetter__(module.split('.').pop(), function(val) {
         value = val;
         
         var func = as.hooks.before[module];
         if (func && func instanceof Function) func(val);
         
         render(render_root, _sc, mkey);
         
         func = as.hooks.after[module];
         if (func && func instanceof Function) func(val);
      });
   }
   
   if (val && !val.charAt) {
      for (var key in val) {
         createProxy(val[key], module + '.' + key, _scope, val, root)
      }
   }
   if (val instanceof Array) {
      var a = ['push', 'pop', 'shift', 'unshift', 'splice']
      for (var i = 0; i < a.length; i++) {
         (function() {
            var method = a[i]
            val[method] = function() {
               var args = arguments
               Array.prototype[method].apply(this, args);
               
               var indexes = [];
               if (method == 'push') indexes.push(val.length-1);
               if (method == 'unshift') indexes.push(0);
               if (method == 'splice' && args.length > 2) {
                  for (var j = 2; j < args.length; j++) {
                     indexes.push(args[0]+j-2);
                  }
               }
               for (var j = 0; j < indexes.length; j++) {
                  var key = indexes[j]
                  createProxy(val[key], module + '.' + key, _scope, val, root)
               }
               var hints = { add: indexes, remove: [] }
               if (method == 'pop') hints.remove.push(val.length-1);
               if (method == 'shift') hints.remove.push(0);
               if (method == 'splice') {
                  for (var j = 0; j < args[1]; j++) {
                     hints.remove.push(args[0]+j);
                  }
               }
               as.hints[module] = hints;
               
               (function(render_root, _sc, mkey, hints, module, val) {
                  setTimeout(function() {
                     var func = as.hooks.before[module];
                     if (func && func instanceof Function) func(val);
                        
                     render(render_root, _sc, mkey, hints);
                     
                     func = as.hooks.after[module];
                     if (func && func instanceof Function) func(val);
                  }, 0)
               })(render_root, _sc, mkey, hints, module, val)
            }
         })()
      }
   }
   
}

function templatesPresent(module, scope, key) {
   if (!scope) scope = 'window'
   var _scope = scope;
   if (_scope.toString() == _scope) {
      scope = eval(scope);
   }
   var els = document.querySelectorAll ? document.querySelectorAll('[asmodel^="' + module + '"]') : document.getElementsByTagName('*')
   for (var i = 0; i < els.length; i++) {
      var prop = els[i].getAttribute('asmodel');
      if (prop === null || (document.all && !prop.match(new RegExp('^' + module))) || 
          prop.match(new RegExp('^' + module + '[a-z0-9$@#_-]', 'i'))) continue
      
      var el_scope = els[i].getAttribute('asscope')
      if (_scope.toString() == _scope && el_scope !== null && el_scope != _scope) continue;
      
      var el_key = els[i].getAttribute('askey')
      if (el_key != null && el_key != key && el_key != '*') continue
      
      if (els[i].getAttribute('astemplate') !== false && !els[i].astemplate) {
         els[i].astemplate = els[i].getAttribute('astemplate')
      }
      
      if (els[i].getAttribute('asjson') || els[i].astemplate && (els[i].astemplate.match(/^func:/) || els[i].astemplate.match(/$value\[/))) {
         return true
      }
   }
   return false
}

function getXmlHttp(){
   return new XMLHttpRequest();
}

function send(url, data) {
   var data = data instanceof Array || data instanceof Object ? JSON.stringify(data) : data.toString()
   var req = getXmlHttp()
   req.open('POST', url, true)
   req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
   req.onload = function() {
      if (as.onpersist && as.onpersist instanceof Function) as.onpersist(data)
   }
   req.onerror = function() {
      var msg = this.status > 0 ? 'Request error: HTTP ' + this.status + ' (' + this.statusText + ')' : 'Content security policy error'
      console.error(msg)
   }
   req.send('data=' + encodeURIComponent(data))
}

function render(module, scope, key, hints) {
   if (!scope) scope = 'window'
   var _scope = scope;
   if (_scope.toString() == _scope) {
      scope = eval(scope);
   }
   var data = scope[module.split('.')[0]]
   var els = document.querySelectorAll ? document.querySelectorAll('[asmodel^="' + module + '"]') : document.getElementsByTagName('*')
   for (var i = 0; i < els.length; i++) {
      processElement(els[i], data, module, scope, _scope, key, hints)
   }
}

function processElement(el, data, module, scope, _scope, key, hints) {
   var prop = el.getAttribute('asmodel');
   if (prop === null) {
      var _el = el;
      while (_el && prop === null) {
         prop = _el.getAttribute('asmodel');
         if (prop) {
            break;
         }
         _el = _el.parentNode;
      }
   }
   
   if (wasRecentInit(el, hints)) {
      return
   }
   
   if (prop === null || (document.all && !prop.match(new RegExp('^' + module))) || 
       prop.match(new RegExp('^' + module + '[a-z0-9$@#_-]', 'i'))) return
   
   var el_scope = el.getAttribute('asscope')
   if (_scope.toString() == _scope && el_scope !== null && el_scope != _scope) return;
   
   var el_key = el.getAttribute('askey')
   if (el_key != null && el_key != key && el_key != '*') return
   
   if (el.getAttribute('astemplate') !== false && !el.astemplate) {
      el.astemplate = el.getAttribute('astemplate')
   }
   var is_input = el.tagName.toLowerCase().match(/^(textarea|input)$/)
   var s = prop.split('.')
   var val = data
   for (var j = 1; j < s.length; j++) {
      val = val instanceof Object && s[j].match(/^[a-z][a-z0-9$@#_-]*$/i) ||
            val instanceof Array && !isNaN(parseInt(s[j])) ?
               val[s[j]] : val
      if (val == undefined) break
   }
   
   if (!el.astemplate && (el.innerHTML.indexOf('{$value') != -1 || el.innerHTML.match(/^func:/))) {
      el.astemplate = el.innerHTML
      el.innerHTML = ''
   }
   
   if (el.getAttribute('aslist') !== null && !el.getAttribute('aslist').match(/^[0-9]+:[0-9]+$/) &&
       el.astemplate && hints && hints.remove) {
      var count = el.children.length
      var b = document.createElement('div')
      b.style.display = 'none'
      b.innerHTML = el.astemplate
      var delta = hints.remove.length
      if (hints.add) delta -= hints.add.length
      var n = el.children.length / (val.length + delta) 
      if (n == parseInt(n) && n == b.children.length) {
         for (var i = 0; i < hints.remove.length; i++) {
            var index = hints.remove[i] * parseInt(n)
            for (var j = 0; j < n; j++) {
               el.children[index+j].parentNode.removeChild(el.children[index+j])
            }
         }
         if (!hints.add || !hints.add.length) {
            el.asprocessedtime = +(new Date())
            return
         }
      }
   }
   if (el.getAttribute('aslist') !== null && el.getAttribute('aslist').match(/^[0-9]+:[0-9]+$/) &&
       el.astemplate && hints) {
      var range = el.getAttribute('aslist').split(':')
      if (hints.add && hints.remove && hints.add.length == hints.remove.length) {
         if (hints.add.filter(function(i) { return i < range[0] }).length == hints.add.length &&
             hints.remove.filter(function(i) { return i < range[0] }).length == hints.remove.length) {
            el.asprocessedtime = +(new Date())
            return
         }
      }
      if (hints.add.filter(function(i) { return i > range[1] }).length == hints.add.length &&
          hints.remove.filter(function(i) { return i > range[1] }).length == hints.remove.length) {
         el.asprocessedtime = +(new Date())
         return
      }
   }
   
   if (val instanceof Object && !el.astemplate) val = formatJSON(el, val)
   if (el.astemplate) val = renderTemplate(el, val, scope, [data, module, scope, _scope, key, hints])
   updateView(el, val, is_input)
   el.asprocessedtime = +(new Date()) 
}

function wasRecentInit(el, hints) {
   var now = +(new Date())
   var threshold = 50
   var _el = el.parentNode
   var last_tag = _el.tagName.toLowerCase()
   while (_el) {
      if (_el.getAttribute && _el.getAttribute('asmodel') && _el.astemplate) {
         if (_el.asprocessedtime && now - _el.asprocessedtime < threshold) {
            return true
         }
      }
      _el = _el.parentNode
      if (_el && _el.tagName) last_tag = _el.tagName.toLowerCase()
   }
   if (!last_tag || !last_tag.match(/^(body|html)$/) && (!hints || !hints.ignore_children)) return true
   return false
}

function updateView(el, val, is_input) {
   if (val === undefined) val = ''
   if (is_input) {
      if (el.type == 'checkbox' || el.type == 'radio') {
         el.checked = !!val
      }
      el.value = val
   }
   else el.innerHTML = val
}

function formatJSON(el, val) {
   if (val instanceof Object && !el.astemplate) {
      if (el.getAttribute('asjson') && el.getAttribute('asjson').match(/^pretty/)) {
         var s = el.getAttribute('asjson')
         var space = s.indexOf(':') != -1 ? s.slice(s.indexOf(':')+1).replace(/\\t/g, '\t').replace(/\*([1-9][0-9]*)$/, function(m, n, i, s) {
            var sp = s.slice(0, i), res = sp, n = parseInt(n);
            for (var i = 2; i < n; i++) {
               res += sp;
            }
            return res
         }) : '4'
         if (space.match(/^[1-9][0-9]*$/)) space = parseInt(space)
      }
      val = JSON.stringify(val, null, el.getAttribute('asjson') && el.getAttribute('asjson').match(/^pretty/) ? space : 0)
   } 
   return val
}

function compileTemplate(el, val, scope) {
   if (el.astemplate.match(/^func:/)) {
      // Compile only once
      if (el.asTplFunc == undefined) {
         el.asTplStacks = []
         var tpl = el.astemplate.slice(5)
         var pos = tpl.indexOf('(')
         var func_name = tpl.slice(0, pos)
         if (scope[func_name]) {
            var n = 0, m = 0
            var args = []
            var token = ''
            pos++
            var index = -1
            var c = tpl.charAt(pos)
            var quote = ''
            var state = 0
            if (c == ',') {
               return '[template error]'
            }
            while (pos < tpl.length) {
               c = tpl.charAt(pos)
               if (c == "\\") {
                  pos++
                  continue
               }
               if (n == 0 && state == 0) {
                  if (c == '[') {
                     n = 1, m = 1, pos++
                     continue
                  }
               }
               if ((c == "'" || c == '"') && n == 0 || n == 1 && c == quote) {
                  n = (n+1)%2
                  if (n == 1) {
                     quote = c, state = 2
                  } else {
                     state = 0
                  }
                  pos++
                  c = tpl.charAt(pos)
               }
               if (n == 1 && state == 0 && tpl.slice(pos-1,pos+1) == '[]') {
                  error = true
                  break
               }
               else if (m == 1 && c == ']' && state < 2) {
                  m = 0
                  if (!(tpl.charAt(pos-1) == "'" || tpl.slice(pos-2,pos) == '\\"')) {
                     token = { value: token }
                  }
                  if (!el.asTplStacks[index]) el.asTplStacks[index] = { tokens: [] }
                  el.asTplStacks[index].tokens.push(token)
                  token = '', state = 0, n = 0
                  if (pos < tpl.length-1 && tpl.charAt(pos+1) == ',') {
                     pos+=2
                     continue
                  }
                  if (pos == tpl.length-1 && tpl.charAt(pos+1) != ')') {
                     return '[template error]'
                  }
                  if (pos == tpl.length-2) {
                     pos += 2
                     break
                  }
               }
               else if (state == 2 &&
                           (c == quote || tpl.slice(pos,pos+2) == '\\' + quote)) {
                  state = 0, quote = ''
               }
               else if ((c == "," || pos == tpl.length-1 && c == ')') && n == 0) {
                  args.push(token.match(/^[0-9]+(\.[0-9]+)?$/) ? Number(token) : token)
                  token = ''
               }
               else if (n > 0 && state > 0 || c.match(/^[0-9.]$/)) {
                  token += c
               }
               else if (c.match(/^\s$/)) {
                  pos++
                  continue
               }
               else {
                  if (tpl.slice(pos, pos+6) != '$value' && !(pos == tpl.length-1 && c == ')')) return '[template error]'
                  index++
                  pos += 6
                  c = tpl.charAt(pos)
                  args.push(c != '[' ? val : null)
                  if (c != '[' && tpl.slice(pos-6, pos) == '$value') el.asValIndex = index
                  if (c == '[') m++
                  if (!(c == ',' || c == '[' || pos == tpl.length-1 && c == ')')) return '[template error]'
               }
               pos++
            }
            el.asTplFunc = scope[func_name]
            el.asTplArgs = args
         } else {
            el.asTplFunc = scope[func_name]
            el.asTplArgs = []
            el.asValIndex = -1
         }
      }
   } else {
      // Compile only once
      if (!el.asTplStacks && !el.asTplError) {
         el.asTplStacks = []
         var tpl = el.astemplate
         var pos = 0, index = 0, last = 0
         while (tpl.indexOf('{$value[', pos) != -1) {
            var pos = tpl.indexOf('{$value[', pos) + 8
            last = pos - 8
            var n = 1, state = 0, quote = '', token = '', error = false
            while (pos < tpl.length) {
               var c = tpl.charAt(pos)
               if (n == 0 && state == 0) {
                  if (c == '[') {
                     n = 1, pos++
                     continue
                  } else if (c == '}') {
                     break
                  }
               }
               if (n == 1 && state == 0 && tpl.slice(pos-1,pos+1) == '[]') {
                  error = true
                  break
               }
               if (n == 1 && c == "'" && tpl.charAt(pos-1) == '[') {
                  state = 2, quote = "'"
               }
               else if (n == 1 && tpl.slice(pos,pos+2) == '\\"') {
                  state = 2, quote = '"', pos++
               } else if (n == 1 && c == ']') {
                  if (!(tpl.charAt(pos-1) == "'" || tpl.slice(pos-2,pos) == '\\"')) {
                     token = { value: token }
                  }
                  if (!el.asTplStacks[index]) el.asTplStacks[index] = { start: last, tokens: [] }
                  el.asTplStacks[index].tokens.push(token)
                  token = '', state = 0, n = 0
               } else if (state == 2 &&
                           (c == quote || tpl.slice(pos,pos+2) == '\\' + quote)) {
                  state = 0, quote = ''
               } else {
                  // not a string literal
                  if (n > 0 && state == 0) state = 1
                  if (n > 0 && state > 0) {
                     token += c
                  }
               }
               pos++
            }
            if (error) {
               el.asTplStacks = null
               el.asTplError = true
               break
            }
            el.asTplStacks[index].end = pos+1
            index++
         }
      }
   }
}

function renderTemplate(el, val, scope, args) {
   if (el.astemplate.match(/^func:/)) {
      if (!el.asTplFunc) compileTemplate(el, val, scope)
      if (!el.getAttribute('aslist')) {
         getFuncArgs(el, val)
         return el.asTplFunc && el.asTplFunc.apply(scope, el.asTplArgs) || ''
      } else if (val && val.length === +val.length) {
         var range = [0, val.length-1]
         var s = el.getAttribute('aslist')
         if (s && s.match(/^[0-9]+:[0-9]+$/)) {
            range = el.getAttribute('aslist').split(':')
         }
         var result = ''
         for (var i = +range[0]; i <= +range[1]; i++) {
            getFuncArgs(el, val[i])
            result += el.asTplFunc.apply(scope, el.asTplArgs)
         }
         return result
      }
   } else {
      if (el.astemplate.indexOf('{$value}') != -1) {
         if (val instanceof Object) val = JSON.stringify(val)
         return el.astemplate.replace('{$value}', val).replace('{\\$value}', '{$value}')
      }
         
      function f(el, val) {
         
         function renderSelf(el) {
            var str = el.astemplate
            var parts = []
            var n = 0
            for (var i = 0; i < el.asTplStacks.length; i++) {
               parts.push(str.slice(n, el.asTplStacks[i].start))
               n = el.asTplStacks[i].end
            }
            parts.push(str.slice(n))
            
            str = parts[0]
            
            for (var i = 0; i < el.asTplStacks.length; i++) {
               var s = el.asTplStacks[i].tokens.slice()
               var data = val
               for (var j = 0; j < s.length; j++) {
                  if (!s[j].charAt && s[j].value) s[j] = eval(s[j].value)
                  data = data instanceof Object && s[j].match && s[j].match(/^[a-z][a-z0-9$@#_-]*$/i) ||
                        data instanceof Array && !isNaN(parseInt(s[j])) ?
                           data[s[j]] : data
                  if (data == undefined) break
               }
               if (data === undefined) data = "{$value['" + el.asTplStacks[i].tokens.join("']['") + "']}"
               if (data instanceof Object) data = JSON.stringify(data)
               str += (data ? data.toString() : '') + parts[i+1]
            }
            return str
         }
         
         var b = document.createElement('div')
         b.style.display = 'none'
         b.innerHTML = el.astemplate
         
         function checkChildElements(el) {
            for (var i = 0; i < el.children.length; i++) {
               checkChildElements(el.children[i])
            }
            if (!el.getAttribute('asmodel') && (el.getAttribute('astemplate') && el.getAttribute('astemplate').match(/^func:/) || el.innerHTML.match(/^func:/)) && val) {
               if (el.getAttribute('astemplate') === null) {
                  el.astemplate = el.innerHTML
               } else if (el.getAttribute('astemplate') !== null && !el.astemplate) {
                  el.astemplate = el.getAttribute('astemplate')
               }
               if (!el.astemplate && (el.innerHTML.indexOf('{$value') != -1 || el.innerHTML.match(/^func:/))) {
                  el.astemplate = el.innerHTML
                  el.innerHTML = ''
               }
               if (!el.asTplFunc) compileTemplate(el, val, scope)
               var source = el.outerHTML.replace(/\s+$/, '')
               getFuncArgs(el, val)
               el.innerHTML = el.asTplFunc && el.asTplFunc.apply(scope, el.asTplArgs) || ''
            }
            if (el.getAttribute('asmodel')) {
               if (!args[5]) args[5] = {}
               args[5]['ignore_children'] = true
               processElement.apply(this, [el].concat(args))
               args[5]['ignore_children'] = false
            }
         }
         
         el.asorigtemplate = el.astemplate
         
         if (!args[5] || !args[5]['ignore_children']) {
            checkChildElements(b)
            if (b.innerHTML != el.astemplate) el.astemplate = b.innerHTML
         }
      
         if (el.asorigtemplate != el.astemplate) {
            el.asTplStacks = null
            el.asTplError = null
         }
         
         if (!el.asTplStacks && !el.asTplError) compileTemplate(el, val, scope)
         
         var str = renderSelf(el)
         
         el.astemplate = el.asorigtemplate
         delete el.asorigtemplate
         
         return str
      }
      
      if (el.getAttribute('aslist') !== null && (!val || val.length === 0)) {
         return ''
      }
      
      var hints = as.hints[el.getAttribute('asmodel')]
      
      if (el.getAttribute('aslist') !== null && val && val.length === +val.length) {
         var range = [0, val.length-1]
         if (el.getAttribute('aslist').match(/^[0-9]+:[0-9]+$/)) {
            range = el.getAttribute('aslist').split(':')
         } else if (hints && hints.add) {
            var result = ''
            for (var j = 0; j < hints.add.length; j++) {
               var i = hints.add[j]
               result += f(el, val[i]).replace(/\s+$/, '').replace('{$index}', i).replace('{\\$index}', '{$index}')
            }
            var b = document.createElement('div')
            b.style.display = 'none'
            b.innerHTML = result
            
            var n1 = el.children.length / (val.length - hints.add.length)
            var n2 = b.children.length / hints.add.length
            if (n1 == n2) {
               for (var i = 0; i < hints.add.length; i++) {
                  for (var j = 0; j < n1; j++) {
                     var index = (hints.add[i] * n1) + j
                     if (index < el.children.length) el.insertBefore(b.children[i * n1 + j], el.children[index])
                     else el.appendChild(b.children[i * n1 + j])
                  }
               }
               return el.innerHTML
            }
         }
         var result = ''
         for (var i = +range[0]; i <= +range[1]; i++) {
            result += f(el, val[i]).replace(/\s+$/, '').replace('{$index}', i).replace('{\\$index}', '{$index}')
         }
         return result
      }
      
      return f(el, val)
   }
}

function getFuncArgs(el, val) {
   if (el.asValIndex > -1) el.asTplArgs[el.asValIndex] = val
   for (var i = 0; i < el.asTplArgs.length; i++) {
      if (el.asTplStacks[i]) {
         var s = el.asTplStacks[i].tokens.slice()
         var data = val
         for (var j = 0; j < s.length; j++) {
            if (!s[j].charAt && s[j].value) s[j] = eval(s[j].value)
            data = data instanceof Object && s[j].match && s[j].match(/^[a-z][a-z0-9$@#_-]*$/i) ||
                  data instanceof Array && !isNaN(parseInt(s[j])) ?
                     data[s[j]] : data
            if (data == undefined) break
         }
         el.asTplArgs[i] = data
      }
   }
}

})()