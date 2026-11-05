/* =========================================================
   Word lists + text preparation helpers
   ========================================================= */
const WORDS = {
  de: `der die das und ist nicht ein eine sie ich er wir ihr es mit auf für von den dem des sich auch als
noch nach bei aus wie wenn nur oder aber vor zur zum hat sind war haben wird werden kann man schon sehr
alle über unter jetzt immer hier dort heute gut neu groß klein lang kurz alt jung viel wenig mehr ganz
gern ja nein doch also dann denn weil dass ob ohne gegen durch bis seit zwischen während wieder
haus hand tag jahr zeit welt mann frau kind leben weg land stadt arbeit frage seite teil fall ende
wasser feuer luft erde licht nacht morgen abend woche monat stunde minute bild buch wort satz text
schule lehrer klasse freund familie vater mutter bruder schwester name nummer platz raum tisch stuhl
tür fenster straße auto bahn zug rad fuß kopf auge ohr mund herz seele geld markt preis kunde firma
gehen kommen sehen geben nehmen machen sagen finden denken wissen lassen stehen liegen sitzen laufen
schreiben lesen lernen spielen sprechen hören fragen zeigen bringen halten führen tragen ziehen fallen
öffnen ändern zählen wählen hören fühlen müssen dürfen möchten können sollen wollen größe übung
schön schnell langsam richtig falsch leicht schwer warm kalt hell dunkel laut leise früh spät
ruhig sicher wichtig möglich einfach klar frei voll leer offen nah weit hoch tief rund
tastatur finger taste zeile übung fehler tempo ziel erfolg fluss schreibmaschine
fast sogar etwa bereits genau eben selbst beide jeder diese jene welche manche keine
die sonne scheint der regen fällt das meer ist blau der wald ist grün
apfel brot milch käse kaffee zucker salz suppe essen trinken küche garten blume baum vogel hund katze
glück ruhe kraft mut idee plan weg ziel grund folge ordnung gruppe system daten frage antwort
fähig ähnlich später natürlich zurück außen innen mädchen bär schüler grüße straße fuß maß`,
  en: `the be to of and a in that have it for not on with he as you do at this but his by from they we
say her she or an will my one all would there their what so up out if about who get which go me when
make can like time no just him know take people into year your good some could them see other than
then now look only come its over think also back after use two how our work first well way even new
want because any these give day most us is was are been has had were said did made find long down
here thing many very still own home hand high keep place where right small large next early young
important few public same able world life school state family group country problem point fact
water fire light night morning evening week month hour minute book word line text page story
house room door window street car road train city friend mother father child name number
write read learn play speak hear ask show bring hold lead carry pull fall open change count choose
feel must should might need try call move live believe happen turn start stop run walk sit stand
fast slow easy hard warm cold bright dark loud quiet early late safe clear free full empty near far
keyboard finger key row practice mistake speed goal success flow typing letter
apple bread milk cheese coffee sugar salt soup food drink kitchen garden flower tree bird dog cat
quick brown fox jumps lazy over just zone quiz jazz exact box mix fix wax vex`,
};
for (const k in WORDS) WORDS[k] = [...new Set(WORDS[k].split(/\s+/).filter(Boolean))];

const SAMPLE_TEXT = `Touch typing is a style of typing in which the typist uses all ten fingers without looking at the keys. Each finger has its own area on the keyboard, and the hands always return to the home row. With regular practice, speed and accuracy grow together, and typing begins to feel like a smooth flow instead of a search for letters.`;

const TextPrep = {
  /** Cleans pasted text according to the session options. */
  clean(raw, { normalize, removeRefs, removePunct, lowercase }) {
    let t = raw;
    if (removeRefs) {
      t = t.replace(/\[(\d+|[a-z]|citation needed|Anm\.? ?\d*|Bearbeiten|edit)\]/gi, '');
    }
    if (normalize) {
      t = t
        .replace(/[‘’‚′´`]/g, "'")
        .replace(/[“”„«»″]/g, '"')
        .replace(/[–—−]/g, '-')
        .replace(/…/g, '...')
        .replace(/[   ]/g, ' ')
        .replace(/­/g, '');      // soft hyphen
    }
    if (removePunct) t = t.replace(/[^\p{L}\p{N}\s'-]/gu, ' ');
    if (lowercase) t = t.toLowerCase();
    // line breaks and runs of whitespace become single spaces
    return t.replace(/\s+/g, ' ').trim();
  },

  words(text) { return text.split(' ').filter(Boolean); },

  /** n random words drawn from the list (with repetition, avoiding immediate repeats). */
  randomWords(list, n) {
    const out = [];
    for (let i = 0; i < n && list.length; i++) {
      let w;
      do { w = list[Math.floor(Math.random() * list.length)]; } while (list.length > 1 && w === out[out.length - 1]);
      out.push(w);
    }
    return out;
  },
};
