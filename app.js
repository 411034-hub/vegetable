(() => {
  const { createApp, reactive, computed } = Vue
  const STORAGE_KEY = 'vocab_app_v1'

  function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
  function load(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch(e){return null}}
  function save(v){localStorage.setItem(STORAGE_KEY,JSON.stringify(v))}

  const app = createApp({
    setup(){
      const state = reactive({
        view: 'study',
        items: load() || [
          {id:genId(), word:'example', translation:'範例', pos:'n.', example:'This is an example.', root:'ex + ample', favorite:false}
        ],
        index: 0,
        flipped: false,
        form: {id:'', word:'', translation:'', pos:'', example:'', root:''},
        manageSearch: ''
      })

      const currentItem = computed(()=> state.items[state.index] || null)

      function persist(){ save(state.items) }

      function nextCard(){ if(state.items.length===0) return; state.index = (state.index+1)%state.items.length; state.flipped=false }
      function prevCard(){ if(state.items.length===0) return; state.index = (state.index-1+state.items.length)%state.items.length; state.flipped=false }
      function shuffle(){ if(state.items.length===0) return; state.index = Math.floor(Math.random()*state.items.length); state.flipped=false }
      function flipCard(){ state.flipped = !state.flipped }

      function resetForm(){ state.form = {id:'', word:'', translation:'', pos:'', example:'', root:''} }

      function saveWord(){
        const f = state.form
        if(!f.word) return alert('請輸入英文單字')
        if(f.id){
          const i = state.items.findIndex(x=>x.id===f.id)
          if(i>=0) state.items.splice(i,1, {...f })
        } else {
          state.items.unshift({...f, id:genId(), favorite:false})
        }
        persist(); resetForm(); state.view='manage'
      }

      function editWord(item){ state.form = {...item}; state.view='manage' }
      function deleteWord(item){ if(!confirm('確定刪除？')) return; state.items = state.items.filter(x=>x.id!==item.id); persist(); }
      function toggleFavorite(item){ if(!item) return; item.favorite = !item.favorite; persist(); }

      const filtered = computed(()=>{
        const q = state.manageSearch.trim().toLowerCase()
        return state.items.filter(it=>!q || it.word.toLowerCase().includes(q))
      })

      // 簡單字根分析 heuristics
      function analyzeRoot(word){
        if(!word) return ''
        const prefixes = ['un','re','in','im','ir','dis','en','em','pre','post','sub','inter']
        const suffixes = ['ing','ed','s','ly','ment','ness','ion','able','ible']
        const lw = word.toLowerCase()
        let pre = '' , suf = '' , root = lw
        for(const p of prefixes) if(lw.startsWith(p)){ pre=p; root = lw.slice(p.length); break }
        for(const s of suffixes) if(root.endsWith(s)){ suf=s; root = root.slice(0, -s.length); break }
        return (pre?pre+' + ':'') + root + (suf?' + '+suf:'')
      }

      // 自動填入：使用 dictionaryapi.dev 與 MyMemory 翻譯
      async function autoFill(){
        const w = state.form.word.trim()
        if(!w) return alert('請先輸入單字再點自動填入')
        try{
          // 1. 取得詞義與例句
          const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`)
          if(dictRes.ok){
            const data = await dictRes.json()
            const meaning = data[0]?.meanings?.[0]
            const def = meaning?.definitions?.[0]
            state.form.pos = meaning?.partOfSpeech || state.form.pos
            state.form.example = def?.example || state.form.example
          }

          // 2. 取得中文翻譯（MyMemory）
          const transRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(w)}&langpair=en|zh-TW`)
          if(transRes.ok){
            const tdata = await transRes.json()
            const translated = tdata.responseData?.translatedText
            if(translated) state.form.translation = translated
          }

          // 3. 簡單字根分析
          state.form.root = analyzeRoot(w)

        }catch(err){ console.error('autoFill error', err); alert('自動填入時發生錯誤，請稍後再試') }
      }

      return {
        view: state.view,
        items: state.items,
        index: state.index,
        flipped: state.flipped,
        form: state.form,
        manageSearch: state.manageSearch,
        currentItem,
        filtered,
        nextCard, prevCard, shuffle, flipCard, resetForm, saveWord, editWord, deleteWord, toggleFavorite, autoFill
      }
    }
  })

  app.mount('#app')

})();
