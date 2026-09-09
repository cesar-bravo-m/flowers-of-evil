# Nightscapes

The photographs behind the *Night* share card (share.js). All twenty are from
Pexels, under the [Pexels License](https://www.pexels.com/license/): free to
use, no attribution required. Credit is given here anyway. Each was downloaded
from the Pexels CDN and scaled to 1920 px on the long side; nothing else was
done to them — the veil that darkens them for the verse is painted onto the
canvas by `share.js`. `thumbs/` holds a 160×200 crop of each for the picker in
the share dialog.

| file | photographer | title | source |
| --- | --- | --- | --- |
| `seine-paris.jpg` | Kirandeep Singh Walia | Palace of the Legion of Honour in Paris | https://www.pexels.com/photo/16909140/ |
| `paris-rooftops.jpg` | Lara Farber | Nighttime View of Parisian Rooftops with Eiffel Tower | https://www.pexels.com/photo/28898181/ |
| `paris-brasserie.jpg` | Daria Agafonova | Iconic Parisian Street Scene at Night | https://www.pexels.com/photo/30297583/ |
| `rain-street.jpg` | Yura Forrat | Rain on City Street at Night | https://www.pexels.com/photo/11866546/ |
| `fog-lamp.jpg` | Elina Volkova | Street Lamp Light under Fog | https://www.pexels.com/photo/16154271/ |
| `crescent-moon.jpg` | Aron Visuals | Crescent Moon Over a Purple Sky | https://www.pexels.com/photo/7053589/ |
| `milky-way-lake.jpg` | eberhard grossgasteiger | Silhouette Photo of Mountain and Calm Body of Water | https://www.pexels.com/photo/1421898/ |
| `starry-lake.jpg` | JackerKun | Starry Sky over a Lake | https://www.pexels.com/photo/14478408/ |
| `stormy-sea.jpg` | Ray Bilcliff | Sea Under Dark Clouds | https://www.pexels.com/photo/5379488/ |
| `lightning-sea.jpg` | Iurii Laimin | Sea Waves Crashing on Shore Under Dark Clouds | https://www.pexels.com/photo/8698559/ |
| `candle.jpg` | Tijana Drndarski | Close-Up Photo of Burning Candle in Dark Background | https://www.pexels.com/photo/5475164/ |
| `black-cat.jpg` | Marek Kupiec | Black Cat With Yellow Eyes | https://www.pexels.com/photo/3974516/ |
| `red-rose.jpg` | Engin Akyurt | Red Rose in Black Background | https://www.pexels.com/photo/6616441/ |
| `rose-petals.jpg` | James Lee | Red Rose in Dark Room | https://www.pexels.com/photo/4077709/ |
| `cemetery-fog.jpg` | KoolShooters | A Foggy Cemetery | https://www.pexels.com/photo/6494460/ |
| `cemetery-gate.jpg` | KoolShooters | Metal Gate in the Cemetery | https://www.pexels.com/photo/6494920/ |
| `moon-bird.jpg` | Martin Lopez | Low Angle Photo of Bird Flying during Night | https://www.pexels.com/photo/2314308/ |
| `church-candle.jpg` | Esra Erdem | Holy Bible in Church | https://www.pexels.com/photo/19130939/ |
| `raven.jpg` | Boys in Bristol Photography | Portrait of a Raven Perching on a Branch | https://www.pexels.com/photo/20922423/ |
| `cathedral-night.jpg` | Ben Kirby | A Gothic Cathedral at Night | https://www.pexels.com/photo/10965017/ |

The same twenty are what the backdrop picker in edit mode offers, behind the
page or behind the verse — but that one asks the dev server what is in
`assets/` rather than reading a list, so it needs no step of its own.

`share.js` opens on one per poem (a hash of the poem id), and the thumbnails
in the share dialog let the reader pick another. Adding a photograph means
dropping the file here, a 160×200 crop of it in `thumbs/`, and an entry in
`PHOTOS` in `share.js`.
