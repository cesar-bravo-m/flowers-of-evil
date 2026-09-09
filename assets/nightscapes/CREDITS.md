# Nightscapes

The photographs behind the *Night* share card (share.js). All thirteen are from
Pexels, under the [Pexels License](https://www.pexels.com/license/): free to
use, no attribution required. Credit is given here anyway. They are as
downloaded from the Pexels CDN, at the size Pexels served them; nothing was
done to them — the veil that darkens them for the verse is painted onto the
canvas by `share.js`. `thumbs/` holds a 160×200 crop of each for the picker in
the share dialog.

Each file keeps the name Pexels gave it, which carries the photographer and the
id of the photo — the photographer and source below are read off the filename,
and the description is what the picker announces to a screen reader. The order
is the order the picker shows them in, which is the order of `PHOTOS` in
`share.js`, not the order of this table.

| file | photographer | shows | source |
| --- | --- | --- | --- |
| `pexels-ahmet-simsek-544065449-17086452.jpg` | Ahmet Simsek | a starry sky over a wooded ridge | https://www.pexels.com/photo/17086452/ |
| `pexels-chudin-alexey-19182293.jpg` | Chudin Alexey | the Milky Way through bare branches | https://www.pexels.com/photo/19182293/ |
| `pexels-matreding-9741544.jpg` | matreding | a blurred treeline against a dusk sky | https://www.pexels.com/photo/9741544/ |
| `pexels-cottonbro-4881621.jpg` | cottonbro studio | one bird alone in a pale sky | https://www.pexels.com/photo/4881621/ |
| `pexels-rahimegul-18470300.jpg` | rahimegul | dark leaves | https://www.pexels.com/photo/18470300/ |
| `pexels-yanho-mo-2154266921-33138953.jpg` | Yanho Mo | roses, some blown, against the dark | https://www.pexels.com/photo/33138953/ |
| `pexels-eugenia-remark-5767088-13918755.jpg` | Eugenia Remark | roses close up, in black and white | https://www.pexels.com/photo/13918755/ |
| `pexels-didsss-10064809.jpg` | didsss | wallpaper printed with gilt roses | https://www.pexels.com/photo/10064809/ |
| `pexels-mary-rose-relente-722720629-37625279.jpg` | Mary Rose Relente | a seraph on a painted church vault | https://www.pexels.com/photo/37625279/ |
| `pexels-polina-kovaleva-6788571.jpg` | Polina Kovaleva | veined black marble | https://www.pexels.com/photo/6788571/ |
| `pexels-dav-h-58867999-7952409.jpg` | Dav H | creased paper | https://www.pexels.com/photo/7952409/ |
| `pexels-dav-h-58867999-7953203.jpg` | Dav H | old paper, ink-spattered | https://www.pexels.com/photo/7953203/ |
| `pexels-heather-green-1125370-18393282.jpg` | Heather Green | a folded, stained page | https://www.pexels.com/photo/18393282/ |

`pexels-dav-h-58867999-7952409.jpg` has a second job: it is the default backdrop
behind the verse card, declared on `:root` in `styles.css`, so a poem that names
no backdrop of its own is read off creased paper.

The same thirteen are what the backdrop picker in edit mode offers, behind the
page or behind the verse — but that one asks the dev server what is in
`assets/` rather than reading a list, so it needs no step of its own.

`share.js` opens on one per poem (a hash of the poem id), and the thumbnails
in the share dialog let the reader pick another. Adding a photograph means
dropping the file here, a 160×200 crop of it in `thumbs/`, and an entry in
`PHOTOS` in `share.js`.
