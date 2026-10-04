import json
V=json.load(open('stotram_verses.json',encoding='utf-8'))
U=dict(numbered=False)
verses=[{"witness":"w1","at":"171","spaced":["hariḥ | oṁ ॥"],**U}]
for v in V:
    verses.append({"witness":"w1","at":v['at'],"spaced":v['spaced'],"translation":v['translation']})
verses.append({"witness":"w1","at":"388","spaced":["sarva praharaṇā-yudha oṁ nama iti ॥"],**U})
verses.append({"witness":"w1","at":"389-390","spaced":["vana mālī gadī śārṅgī śaṅkhī cakrī ca nandakī ।","śrīmān nārāyaṇo viṣṇur vāsudevo'bhirakṣatu ॥"],
  "translation":"Wearing the forest garland, holding the mace, the bow Śārṅga, the conch, the discus and the sword Nandaka,\nmay the glorious Nārāyaṇa, Viṣṇu, Vāsudeva protect us."})
verses.append({"witness":"w1","at":"391","spaced":["śrī vāsudevo'bhirakṣatu oṁ nama iti ॥"],**U})
doc={"title":"śrī viṣṇu sahasranāma stotram","subtitle":"mahābhārata","locus":"mahābhārata, anuśāsana parva 149","source":"smarta",
 "sections":[{"title":"stotram","verses":verses}]}
json.dump(doc,open('b2.json','w',encoding='utf-8'),ensure_ascii=False)
print(len(verses))
