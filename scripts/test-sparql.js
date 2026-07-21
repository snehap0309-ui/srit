const https = require('https');

const q = `SELECT DISTINCT ?place ?placeLabel ?stateLabel ?cityLabel WHERE {
  { VALUES ?type { wd:Q570116 } ?place wdt:P31/wdt:P279* ?type. }
  ?place wdt:P17 wd:Q668; wdt:P625 ?coord; wdt:P18 ?image.
  OPTIONAL { ?place wdt:P131* ?state. ?state wdt:P31 wd:Q130768. }
  OPTIONAL { ?place wdt:P131+ ?city. ?city wdt:P31/wdt:P279* wd:Q515. }
  SERVICE wikibase:label { 
    bd:serviceParam wikibase:language "en". 
    ?place rdfs:label ?placeLabel. 
    ?state rdfs:label ?stateLabel. 
    ?city rdfs:label ?cityLabel. 
  }
} LIMIT 5`;

const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(q);

https.get(url, { headers: { 'Accept': 'application/sparql-results+json', 'User-Agent': 'PalSafar/1.0' } }, (res) => {
  let data = ''; 
  res.on('data', d => data += d);
  res.on('end', () => console.log(data));
});
