export interface NuvioDirectoryPlugin {
  id: string;
  name: string;
  description: string;
  types: string[];
  languages: string[];
  icon?: string;
}

export interface NuvioDirectoryRepo {
  id: string;
  name: string;
  author: string;
  description: string;
  tags: string[];
  types: string[];
  languages: string[];
  manifestUrl: string;
  plugins: NuvioDirectoryPlugin[];
}

export interface StremioNetDirectoryAddon {
  id: string;
  slug: string;
  name: string;
  manifestUrl: string;
  description: string;
  logo?: string;
  category: 'Streams' | 'Hindi & Regional' | 'Anime' | 'Live TV & Sports' | 'Subtitles' | 'Catalogs';
}

export const NUVIO_PLUGIN_REPOS: NuvioDirectoryRepo[] = [
  {
    "id": "nuvio-yoruix-0",
    "name": "Yoru",
    "author": "yoruix",
    "description": "The core multi-language provider for Nuvio.",
    "tags": [
      "Multi language"
    ],
    "types": [
      "movie",
      "tv"
    ],
    "languages": [
      "en"
    ],
    "manifestUrl": "https://raw.githubusercontent.com/yoruix/nuvio-providers/refs/heads/main/manifest.json",
    "plugins": [
      {
        "id": "yoruix-0-4khdhub",
        "name": "4KHDHub",
        "description": "4KHDHub direct links",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://www.google.com/s2/favicons?domain=4khdhub.fans&sz=128"
      },
      {
        "id": "yoruix-1-animekai",
        "name": "AnimeKai",
        "description": "AnimeKai TV episodes via AnimeKai servers",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://animekai.to/assets/uploads/37585a39fe8c8d8fafaa2c7bfbf5374ecac859ea6a0288a6da2c61f5.png"
      },
      {
        "id": "yoruix-2-animepahe",
        "name": "AnimePahe",
        "description": "AnimePahe (Sub/Dub)",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://www.google.com/s2/favicons?domain=animepahe.ru&sz=128"
      },
      {
        "id": "yoruix-3-uhdmovies",
        "name": "UHDMovies",
        "description": "UHD Movies streaming with multiple resolution",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://www.google.com/s2/favicons?domain=uhdmovies.ink&sz=128"
      },
      {
        "id": "yoruix-4-moviesmod",
        "name": "MoviesMod",
        "description": "Movie and TV show streams from MoviesMod with multiple quality options",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://www.google.com/s2/favicons?domain=moviesmod.day&sz=128"
      },
      {
        "id": "yoruix-5-dahmermovies",
        "name": "DahmerMovies",
        "description": "Dahmer Movies streaming service. Use if needed.",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://image.similarpng.com/file/similarpng/very-thumbnail/2021/05/Letter-D-logo-design-template-with-geometric-shape-style-on-transparent-background-PNG.png"
      },
      {
        "id": "yoruix-6-netmirror",
        "name": "NetMirror",
        "description": "Streaming links from netmirror. (No iOS support)",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://net22.cc/favicon.ico"
      },
      {
        "id": "yoruix-7-streamflix",
        "name": "StreamFlix",
        "description": "Direct links via StreamFlix API",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hin"
        ],
        "icon": "https://streamflix.app/assets/images/logo-text-148x72.png"
      },
      {
        "id": "yoruix-8-moviebox",
        "name": "MovieBox",
        "description": "MovieBox streaming with multiple language support",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hin",
          "tam",
          "tel"
        ],
        "icon": "https://moviebox.ph/favicon.ico"
      },
      {
        "id": "yoruix-9-vixsrc",
        "name": "Vixsrc",
        "description": "Vixsrc M3U8 streaming with auto quality",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://vixsrc.to/favicon.ico"
      },
      {
        "id": "yoruix-10-dvdplay",
        "name": "DVDPlay",
        "description": "DVDPlay direct download links",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "mal",
          "tam",
          "hin"
        ],
        "icon": "https://www.google.com/s2/favicons?domain=dvdplay.com&sz=128"
      },
      {
        "id": "yoruix-11-yflix",
        "name": "YFlix",
        "description": "YFlix streaming",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://yflix.to/assets/uploads/2f505f3de3c99889c1a72557f3e3714fc0c457b0.png"
      },
      {
        "id": "yoruix-12-videasy",
        "name": "VIDEASY",
        "description": "VideoEasy streaming with multiple servers",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "de",
          "it",
          "fr",
          "hi",
          "es",
          "pt"
        ],
        "icon": "https://www.videasy.net/logo.png"
      },
      {
        "id": "yoruix-13-mallumv",
        "name": "MalluMV",
        "description": "MalluMV direct links for South Indian movies",
        "types": [
          "movie"
        ],
        "languages": [
          "ta",
          "te",
          "hi",
          "ml",
          "kn"
        ],
        "icon": "https://mallumv.life/favicon.ico"
      },
      {
        "id": "yoruix-14-vidlink",
        "name": "Vidlink",
        "description": "Vidlink streaming with encrypted TMDB ID",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://vidlink.pro/favicon.ico"
      },
      {
        "id": "yoruix-15-vidnest",
        "name": "Vidnest",
        "description": "Vidnest streaming with encrypted AES-GCM",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://vidnest.fun/favicon.ico"
      },
      {
        "id": "yoruix-16-vidnestanime",
        "name": "VidnestAnime",
        "description": "Vidnest anime streaming with mappings",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hi",
          "ja"
        ],
        "icon": "https://vidnest.fun/favicon.ico"
      },
      {
        "id": "yoruix-17-cinevibe",
        "name": "Cinevibe",
        "description": "Cinevibe (Movies)",
        "types": [
          "movie"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://www.google.com/s2/favicons?domain=cinevibe.online&sz=128"
      },
      {
        "id": "yoruix-18-cinemacity",
        "name": "CinemaCity",
        "description": "CinemaCity (Multi-Language)",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hi",
          "ta",
          "te",
          "id",
          "pl",
          "ar"
        ],
        "icon": "https://www.google.com/s2/favicons?domain=cinema-city.pl&sz=128"
      },
      {
        "id": "yoruix-19-castle",
        "name": "Castle",
        "description": "Multi Lang provider",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hi",
          "ta",
          "te",
          "ml",
          "kn"
        ],
        "icon": "https://static.hbayy.com/simple-blog-13/prod/_nuxt/big-logo.DESZ4mBj.png"
      },
      {
        "id": "yoruix-20-showbox",
        "name": "ShowBox",
        "description": "ShowBox streaming with multiple quality",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://raw.githubusercontent.com/tapframe/nuvio-providers/main/Assets/Logo-2.png"
      },
      {
        "id": "yoruix-21-hdhub4u",
        "name": "HDHub4u",
        "description": "Direct links from HDHub4u",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hin"
        ],
        "icon": "https://www.google.com/s2/favicons?domain=hdhub4u.me.uk&sz=128"
      },
      {
        "id": "yoruix-22-allmovieland",
        "name": "AllMovieLand",
        "description": "AllMovieLand with multi-language support",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hi",
          "ta",
          "te"
        ],
        "icon": "https://www.google.com/s2/favicons?domain=allmovieland.cc&sz=128"
      },
      {
        "id": "yoruix-23-dooflix",
        "name": "DooFlix",
        "description": "Fast streaming with direct TMDB integration",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hi"
        ],
        "icon": "https://www.google.com/s2/favicons?domain=dooflix.org&sz=128"
      },
      {
        "id": "yoruix-24-movieblast",
        "name": "MovieBlast",
        "description": "Direct links via MovieBlast API with multi-language support",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "te",
          "hi",
          "en"
        ],
        "icon": "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/Icons/movieblast.png"
      },
      {
        "id": "yoruix-25-mycima",
        "name": "MyCima",
        "description": "Arabic streaming provider",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "ar"
        ],
        "icon": "https://www.google.com/s2/favicons?domain=wecima.show&sz=128"
      }
    ]
  },
  {
    "id": "nuvio-d3adlyrocket-1",
    "name": "NuvioPlugin All-in-One",
    "author": "NuvioPlugin",
    "description": "Multi language premium provider.",
    "tags": [
      "Multi language"
    ],
    "types": [
      "movie",
      "tv"
    ],
    "languages": [
      "en",
      "hi"
    ],
    "manifestUrl": "https://raw.githubusercontent.com/NuvioPlugin/All-in-One-Nuvio/refs/heads/main/manifest.json",
    "plugins": [
      {
        "id": "d3adlyrocket-0-hianime",
        "name": "HiAnime",
        "description": "HiAnime - Anime and Asian content streaming",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hi"
        ],
        "icon": "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/Icons/hianime.png"
      },
      {
        "id": "d3adlyrocket-1-4khdhub",
        "name": "4KHDHub",
        "description": "4KHDHub direct links",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://i.postimg.cc/DZpW6Xfb/4khdhub.png"
      },
      {
        "id": "d3adlyrocket-2-allwish",
        "name": "AllWish",
        "description": "All-Wish TV episodes via All-Wish servers",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "ja"
        ],
        "icon": "https://i.postimg.cc/WpFW45WQ/allwish.png"
      },
      {
        "id": "d3adlyrocket-3-animekai",
        "name": "AnimeKai",
        "description": "AnimeKai TV episodes via AnimeKai servers",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://i.postimg.cc/MKJd7fy7/animekai.png"
      },
      {
        "id": "d3adlyrocket-4-animepahe",
        "name": "AnimePahe",
        "description": "Watch anime online free in HD with fast streaming servers",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "ja"
        ],
        "icon": "https://i.postimg.cc/c4ZBGNNs/animepahe.png"
      },
      {
        "id": "d3adlyrocket-5-animesalt",
        "name": "AnimeSalt",
        "description": "AnimeSalt India",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "hi",
          "en",
          "ja"
        ],
        "icon": "https://i.postimg.cc/1X24MYhg/animesalt.png"
      },
      {
        "id": "d3adlyrocket-6-animeworld",
        "name": "AnimeWorld",
        "description": "Watch AnimeWorld India",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "hi",
          "en",
          "ja"
        ],
        "icon": "https://i.postimg.cc/wxD6rVKX/animeworld.png"
      },
      {
        "id": "d3adlyrocket-7-animesama",
        "name": "Anime-Sama",
        "description": "Watch AnimeSama France",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "fr"
        ],
        "icon": "https://i.postimg.cc/tgYt2pYG/animesama.png"
      },
      {
        "id": "d3adlyrocket-8-allmovieland",
        "name": "AllMovieLand",
        "description": "AllMovieLand streaming provider with multi-language support",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hi",
          "ta",
          "te"
        ],
        "icon": "https://i.postimg.cc/hhWqkVQs/allmovieland.png"
      },
      {
        "id": "d3adlyrocket-9-brazucaplay",
        "name": "BrazucaPlay",
        "description": "Brazuca Play - Movies & Series in English & Portuguese",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "pt"
        ],
        "icon": "https://i.postimg.cc/9F6zdnyb/brazucaplay.png"
      },
      {
        "id": "d3adlyrocket-10-castle",
        "name": "Castle",
        "description": "Multi Lang provider",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://i.postimg.cc/0NvGzFyK/castle.png"
      },
      {
        "id": "d3adlyrocket-11-cinemacity",
        "name": "CinemaCity",
        "description": "Multi Language Provider",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hi",
          "ar"
        ],
        "icon": "https://i.postimg.cc/XYjKhS3b/cinemacity.png"
      },
      {
        "id": "d3adlyrocket-12-cinestream",
        "name": "CineStream",
        "description": "Multi Language Provider",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hi"
        ],
        "icon": "https://i.postimg.cc/0NhjWWqT/cinestream.png"
      },
      {
        "id": "d3adlyrocket-13-dahmermovies",
        "name": "Dahmermovies",
        "description": "Auto-generated description for Dahmermovies",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://i.postimg.cc/hGt3dV6Z/dhamermovies.png"
      },
      {
        "id": "d3adlyrocket-14-diziyou",
        "name": "DiziYou",
        "description": "Movies & Series in English & Turkish",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "tr"
        ],
        "icon": "https://i.postimg.cc/K8nYLrL3/diziyou.png"
      },
      {
        "id": "d3adlyrocket-15-dooflix",
        "name": "DooFlix",
        "description": "Fast streaming provider with direct TMDB integration",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "es"
        ],
        "icon": "https://i.postimg.cc/59H1DmRk/dooflix.png"
      },
      {
        "id": "d3adlyrocket-16-embed69",
        "name": "Embed69",
        "description": "Movies & Series in English & Spanish",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "es"
        ],
        "icon": "https://i.postimg.cc/SK9YMsHG/embed69.png"
      },
      {
        "id": "d3adlyrocket-17-flixindia",
        "name": "FlixIndia",
        "description": "Streaming provider for FlixIndia",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hi"
        ],
        "icon": "https://i.postimg.cc/4xSPpSbb/onepieceskull.png"
      },
      {
        "id": "d3adlyrocket-18-hdhub4u",
        "name": "HDHub4u",
        "description": "Direct links from HDHub4u with high-speed download",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://i.postimg.cc/mryRTf0R/hdhub4u.png"
      },
      {
        "id": "d3adlyrocket-19-hindmoviez",
        "name": "HindMoviez",
        "description": "HindMoviez - Hindi & English Movies and Series",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hi"
        ],
        "icon": "https://i.postimg.cc/5t55Csm4/hindmoviez.png"
      },
      {
        "id": "d3adlyrocket-20-hdmovie2",
        "name": "HDMovie2",
        "description": "Bollywood & Hindi Dubbed Movies",
        "types": [
          "movie"
        ],
        "languages": [
          "hi",
          "en"
        ],
        "icon": "https://i.postimg.cc/bJnfnzHS/hdmovie2.png"
      },
      {
        "id": "d3adlyrocket-21-isaidub",
        "name": "Isaidub",
        "description": "Tamil Dubbed Movies",
        "types": [
          "movie"
        ],
        "languages": [
          "ta"
        ],
        "icon": "https://i.postimg.cc/0jMv4cQH/isaidub.png"
      },
      {
        "id": "d3adlyrocket-22-lamovie",
        "name": "LA.Movie",
        "description": "Streams in Eng/Lat/Spa from LaMovie",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "es"
        ],
        "icon": "https://i.postimg.cc/SsgH2gcK/lamovie.png"
      },
      {
        "id": "d3adlyrocket-23-moviebox",
        "name": "MovieBox",
        "description": "MovieBox - Hindi, Tamil, Telugu & English Movies/Series",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hi",
          "ta",
          "te"
        ],
        "icon": "https://i.postimg.cc/TPwkfqHh/moviebox.png"
      },
      {
        "id": "d3adlyrocket-24-movieblast",
        "name": "MovieBlast",
        "description": "MovieBlast - Hindi, Tamil, Telugu & English Movies/Series",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hi",
          "ta",
          "te"
        ],
        "icon": "https://i.postimg.cc/qqkLSyhN/movieblast.png"
      },
      {
        "id": "d3adlyrocket-25-moviesdrive",
        "name": "MoviesDrive",
        "description": "Movies and TV shows with multiple streaming servers",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hi"
        ],
        "icon": "https://i.postimg.cc/bwDbhq9q/moviesdrive.png"
      },
      {
        "id": "d3adlyrocket-26-moviesmod",
        "name": "MoviesMod",
        "description": "Movie and TV show streams with multiple quality options",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://i.postimg.cc/YqWDJtWW/moviesmod.png"
      },
      {
        "id": "d3adlyrocket-27-movies4u",
        "name": "Movies4u",
        "description": "Auto-generated description for Movies4u",
        "types": [
          "movie"
        ],
        "languages": [
          "en",
          "hi",
          "ta"
        ],
        "icon": "https://i.postimg.cc/J0QG1QhQ/movies4u.jpg"
      },
      {
        "id": "d3adlyrocket-28-movixvf",
        "name": "Movix VF",
        "description": "Movies and TV series in English & French",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "fr"
        ],
        "icon": "https://i.postimg.cc/XYrPQm87/movix.png"
      },
      {
        "id": "d3adlyrocket-29-nakios",
        "name": "Nakios",
        "description": "Mainly French, Some English & 4K Quality",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "fr",
          "en"
        ],
        "icon": "https://i.postimg.cc/nLwY1pJB/nakios.png"
      },
      {
        "id": "d3adlyrocket-30-netmirror",
        "name": "Netmirror",
        "description": "Streaming links from Netmirror (Netflix, Prime, Disney etc)",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://i.postimg.cc/L64M3bYV/netmirror.png"
      },
      {
        "id": "d3adlyrocket-31-purstream",
        "name": "Purstream",
        "description": "Films and series in French (VF/VOSTFR/MULTI)",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "fr"
        ],
        "icon": "https://i.postimg.cc/7L5shxmC/purstream.png"
      },
      {
        "id": "d3adlyrocket-32-rgshows",
        "name": "RGShows",
        "description": "Discover and stream your favorite Movies, TV Shows & Anime",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://i.postimg.cc/kXNS9837/rgshows.png"
      },
      {
        "id": "d3adlyrocket-33-showbox",
        "name": "ShowBox",
        "description": "ShowBox streaming with multiple quality versions",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://i.postimg.cc/8c5XGzsx/showbox.png"
      },
      {
        "id": "d3adlyrocket-34-streamflix",
        "name": "Streamflix",
        "description": "Direct links via StreamFlix in Hindi",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://i.postimg.cc/4yVjQjpH/streamflix.png"
      },
      {
        "id": "d3adlyrocket-35-streamflixen",
        "name": "Streamflix-En",
        "description": "Direct links via StreamFlix in English",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://i.postimg.cc/4yVjQjpH/streamflix.png"
      },
      {
        "id": "d3adlyrocket-36-uhdmovies",
        "name": "UHDMovies",
        "description": "UHD Movies streaming with multiple resolution",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://i.postimg.cc/KzDBBdbK/uhdmovies.png"
      },
      {
        "id": "d3adlyrocket-37-vidlink",
        "name": "Vidlink",
        "description": "Vidlink streaming with encrypted TMDB ID",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://i.postimg.cc/wMHSw2Vb/vidlink.png"
      },
      {
        "id": "d3adlyrocket-38-videasy",
        "name": "Videasy",
        "description": "Videasy streaming with encrypted TMDB ID",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://i.postimg.cc/7LHYMtVV/videasy.png"
      },
      {
        "id": "d3adlyrocket-39-vixsrc",
        "name": "Vixsrc",
        "description": "Auto-generated description for Vixsrc",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://i.postimg.cc/tJP8zc5K/vixsrc.png"
      },
      {
        "id": "d3adlyrocket-40-onlykdrama",
        "name": "OnlyKDrama",
        "description": "Asian Drama",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "ko"
        ],
        "icon": "https://i.postimg.cc/dtX84Gqc/onlykdrama.jpg"
      },
      {
        "id": "d3adlyrocket-41-kisskh",
        "name": "Kisskh",
        "description": "Asian Drama & Anime streaming",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "ko",
          "ch",
          "ja",
          "th"
        ],
        "icon": "https://i.postimg.cc/2yLnTzPP/kisskh.jpg"
      },
      {
        "id": "d3adlyrocket-42-dramafull",
        "name": "DramaFull",
        "description": "Specializes in Asian dramas",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "ko",
          "zh",
          "ja"
        ],
        "icon": "https://dramafull.cc/favicon.ico"
      },
      {
        "id": "d3adlyrocket-43-xdmovies",
        "name": "XDMovies",
        "description": "Premium streaming with multiple quality options and servers",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hi"
        ],
        "icon": "https://i.postimg.cc/4xSPpSbb/onepieceskull.png"
      },
      {
        "id": "d3adlyrocket-44-twoembed",
        "name": "TwoEmbed",
        "description": "Alternative streaming provider with multiple sources",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hi"
        ],
        "icon": "https://i.postimg.cc/4xSPpSbb/onepieceskull.png"
      }
    ]
  },
  {
    "id": "nuvio-phisher98-2",
    "name": "Phisher",
    "author": "phisher98",
    "description": "Multi language provider by Phisher.",
    "tags": [
      "Multi language"
    ],
    "types": [
      "movie",
      "tv"
    ],
    "languages": [
      "en"
    ],
    "manifestUrl": "https://raw.githubusercontent.com/phisher98/nuvio-providers/refs/heads/main/manifest.json",
    "plugins": [
      {
        "id": "phisher98-0-moviesdrive",
        "name": "MoviesDrive",
        "description": "MoviesDrive streaming with multiple quality options and versions",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://i.imgur.com/9bGkGMi.png"
      },
      {
        "id": "phisher98-1-hianime",
        "name": "HiAnime",
        "description": "HiAnime Anime Streaming",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/Icons/hianime.png"
      },
      {
        "id": "phisher98-2-xdmovies",
        "name": "XDMovies",
        "description": "XDMovies Multi-Lang Movies/TVSeries Streaming",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "hi"
        ],
        "icon": "https://xdmovies.site/assets/logo1.png"
      }
    ]
  },
  {
    "id": "nuvio-michat88-3",
    "name": "Michat88",
    "author": "michat88",
    "description": "Multi language manifest for various sources.",
    "tags": [
      "Multi language"
    ],
    "types": [
      "movie",
      "tv"
    ],
    "languages": [
      "en",
      "id"
    ],
    "manifestUrl": "https://raw.githubusercontent.com/michat88/nuvio-providers/refs/heads/main/manifest.json",
    "plugins": [
      {
        "id": "michat88-0-kisskh",
        "name": "Kisskh",
        "description": "Asian Drama & Anime streaming",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "id"
        ],
        "icon": "https://kisskh.ovh/favicon.ico"
      },
      {
        "id": "michat88-1-4khdhub",
        "name": "4khdhub",
        "description": "Auto-generated description for 4khdhub",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-2-animekai",
        "name": "Animekai",
        "description": "Auto-generated description for Animekai",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-3-castle",
        "name": "Castle",
        "description": "Auto-generated description for Castle",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-4-cinevibe",
        "name": "Cinevibe",
        "description": "Auto-generated description for Cinevibe",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-5-dahmermovies",
        "name": "Dahmermovies",
        "description": "Auto-generated description for Dahmermovies",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-6-dvdplay",
        "name": "Dvdplay",
        "description": "Auto-generated description for Dvdplay",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-7-hdhub4u",
        "name": "Hdhub4u",
        "description": "Auto-generated description for Hdhub4u",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-8-hdrezka",
        "name": "Hdrezka",
        "description": "Auto-generated description for Hdrezka",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-9-idlix",
        "name": "Idlix",
        "description": "Auto-generated description for Idlix",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-10-mallumv",
        "name": "Mallumv",
        "description": "Auto-generated description for Mallumv",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-11-mapple",
        "name": "Mapple",
        "description": "Auto-generated description for Mapple",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-12-moviebox",
        "name": "Moviebox",
        "description": "Auto-generated description for Moviebox",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-13-moviesmod",
        "name": "Moviesmod",
        "description": "Auto-generated description for Moviesmod",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-14-myflixerextractor",
        "name": "Myflixer-extractor",
        "description": "Auto-generated description for Myflixer-extractor",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-15-netmirror",
        "name": "Netmirror",
        "description": "Auto-generated description for Netmirror",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-16-showbox",
        "name": "Showbox",
        "description": "Auto-generated description for Showbox",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-17-streamflix",
        "name": "Streamflix",
        "description": "Auto-generated description for Streamflix",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-18-uhdmovies",
        "name": "Uhdmovies",
        "description": "Auto-generated description for Uhdmovies",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-19-videasy",
        "name": "Videasy",
        "description": "Auto-generated description for Videasy",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-20-vidlink",
        "name": "Vidlink",
        "description": "Auto-generated description for Vidlink",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-21-vidnestanime",
        "name": "Vidnest-anime",
        "description": "Auto-generated description for Vidnest-anime",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-22-vidnest",
        "name": "Vidnest",
        "description": "Auto-generated description for Vidnest",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-23-vidrock",
        "name": "Vidrock",
        "description": "Auto-generated description for Vidrock",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-24-vidsrc",
        "name": "Vidsrc",
        "description": "Auto-generated description for Vidsrc",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-25-vixsrc",
        "name": "Vixsrc",
        "description": "Auto-generated description for Vixsrc",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-26-watch32",
        "name": "Watch32",
        "description": "Auto-generated description for Watch32",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-27-xprime",
        "name": "Xprime",
        "description": "Auto-generated description for Xprime",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-28-yflix",
        "name": "Yflix",
        "description": "Auto-generated description for Yflix",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      },
      {
        "id": "michat88-29-adimoviebox",
        "name": "Adimoviebox",
        "description": "Auto-generated description for Adimoviebox",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": ""
      }
    ]
  },
  {
    "id": "nuvio-abinanthankv-4",
    "name": "Spidey",
    "author": "Abinanthankv",
    "description": "Tamil content manifest for Nuvio.",
    "tags": [
      "Tamil"
    ],
    "types": [
      "movie",
      "tv"
    ],
    "languages": [
      "ta",
      "en"
    ],
    "manifestUrl": "https://raw.githubusercontent.com/Abinanthankv/NuvioRepo/refs/heads/master/manifest.json",
    "plugins": [
      {
        "id": "abinanthankv-0-tamilmv",
        "name": "TamilMV",
        "description": "TamilMV provider for Nuvio.",
        "types": [
          "movie"
        ],
        "languages": [
          "ta",
          "en"
        ],
        "icon": "https://www.1tamilmv.band/uploads/monthly_2025_02/logo.png.bcc33561bc1d7345f7c6237a80238992.png"
      },
      {
        "id": "abinanthankv-1-tamilblasters",
        "name": "Tamilblasters",
        "description": "Tamilblasters provider for Nuvio.",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "ta",
          "en"
        ],
        "icon": "https://1tamilblasters.bz/uploads/monthly_2025_10/169356039_TBLwhitelogo.png.50e3c98229dab88b167074a68df15caf.png"
      },
      {
        "id": "abinanthankv-2-tamilian",
        "name": "Tamilian",
        "description": "Tamilian provider for Nuvio.",
        "types": [
          "movie"
        ],
        "languages": [
          "ta",
          "en"
        ],
        "icon": ""
      },
      {
        "id": "abinanthankv-3-moviesda",
        "name": "Moviesda",
        "description": "Moviesda provider for Nuvio.",
        "types": [
          "movie"
        ],
        "languages": [
          "ta",
          "en"
        ],
        "icon": ""
      },
      {
        "id": "abinanthankv-4-movies4u",
        "name": "Movies4u",
        "description": "Movies4u provider for Nuvio.",
        "types": [
          "movie"
        ],
        "languages": [
          "en",
          "ta",
          "hi"
        ],
        "icon": ""
      },
      {
        "id": "abinanthankv-5-isaidub",
        "name": "Isaidub",
        "description": "Isaidub provider for Nuvio",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "ta",
          "en"
        ],
        "icon": ""
      },
      {
        "id": "abinanthankv-6-toonhub",
        "name": "ToonHub",
        "description": "ToonHub provider for Nuvio (Animes & Cartoons)",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "hi",
          "en"
        ],
        "icon": "https://toonhub4u.co/wp-content/uploads/2024/02/Untitled.png"
      },
      {
        "id": "abinanthankv-7-animelok",
        "name": "Animelok",
        "description": "Animelok provider for Nuvio (Anime in multiple languages)",
        "types": [
          "tv",
          "movie"
        ],
        "languages": [
          "hi",
          "ta",
          "te",
          "ml",
          "en",
          "ja"
        ],
        "icon": "https://animelok.to/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flogo.5c53cc50.png&w=384&q=75"
      },
      {
        "id": "abinanthankv-8-xdmovies",
        "name": "XDmovies",
        "description": "XDmovies provider for Nuvio (Movies and TV Shows)",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hi"
        ],
        "icon": "https://xdmovies.site/assets/logo1.png"
      },
      {
        "id": "abinanthankv-9-dramafull",
        "name": "DramaFull",
        "description": "DramaFull provider for Nuvio. Specializes in Asian dramas.",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "ko",
          "zh",
          "ja"
        ],
        "icon": "https://dramafull.cc/favicon.ico"
      }
    ]
  },
  {
    "id": "nuvio-saimuelbr-6",
    "name": "Saimuelbr",
    "author": "saimuelbr",
    "description": "Portuguese (BR) content manifest.",
    "tags": [
      "Portuguese (BR)"
    ],
    "types": [
      "movie",
      "tv"
    ],
    "languages": [
      "pt"
    ],
    "manifestUrl": "https://raw.githubusercontent.com/saimuelbr/saimuel-nuvio-repo/refs/heads/main/manifest.json",
    "plugins": [
      {
        "id": "saimuelbr-0-fembed",
        "name": "Fembed",
        "description": "Fembed API - Filmes, Séries e Animes em Português.",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "pt"
        ],
        "icon": "https://fembed.sx/assets/favicon.png"
      },
      {
        "id": "saimuelbr-1-fshd",
        "name": "FSHD",
        "description": "FSHD - Séries em 1080p (Português).",
        "types": [
          "tv"
        ],
        "languages": [
          "pt"
        ],
        "icon": "https://fshd.link/favicon.ico"
      }
    ]
  },
  {
    "id": "nuvio-gowaru-8",
    "name": "Gowaru",
    "author": "Gowaru",
    "description": "French content manifest for anime and movies.",
    "tags": [
      "French"
    ],
    "types": [
      "movie",
      "tv"
    ],
    "languages": [
      "fr"
    ],
    "manifestUrl": "https://raw.githubusercontent.com/Gowaru/gowaru-nuvio-providers/refs/heads/main/manifest.json",
    "plugins": [
      {
        "id": "gowaru-0-animesama",
        "name": "Anime-Sama",
        "description": "Un des plus gros catalogues français, très actif, sorties du jour.",
        "types": [
          "tv",
          "movie"
        ],
        "languages": [
          "fr"
        ],
        "icon": "https://raw.githubusercontent.com/Anime-Sama/IMG/img/autres/logo.png"
      },
      {
        "id": "gowaru-1-voiranime",
        "name": "VoirAnime",
        "description": "Un des plus gros catalogues français d'animes.",
        "types": [
          "tv",
          "movie"
        ],
        "languages": [
          "fr"
        ],
        "icon": "https://lh3.googleusercontent.com/728eE_dzDC7HWN9Cs2eGkQg4Vlk1CqCJj3T8aAQs50srttRUl6pVmmD0O4t1Zxn4fdiVpPzcoPAzNS2EuUre29Dulw=s60"
      },
      {
        "id": "gowaru-2-vostfree",
        "name": "Vostfree",
        "description": "Animes VF et VOSTFR en streaming et téléchargement.",
        "types": [
          "tv",
          "movie"
        ],
        "languages": [
          "fr"
        ],
        "icon": "https://vostfree.ws/templates/Animix/images/logo.png"
      },
      {
        "id": "gowaru-3-franime",
        "name": "FRAnime",
        "description": "Regarder des animes VF et VOSTFR gratuitement sur FRAnime.",
        "types": [
          "tv",
          "movie"
        ],
        "languages": [
          "fr"
        ],
        "icon": "https://franime.fr/logo.png"
      },
      {
        "id": "gowaru-4-frenchanime",
        "name": "French-Anime",
        "description": "Animes VF et VOSTFR en streaming gratuit sur French Anime.",
        "types": [
          "tv",
          "movie"
        ],
        "languages": [
          "fr"
        ],
        "icon": "https://french-anime.com/templates/franime/images/favicon3.png"
      },
      {
        "id": "gowaru-5-animevostfr",
        "name": "AnimeVOSTFR",
        "description": "Animes VF et VOSTFR en streaming gratuit on AnimeVOSTFR.",
        "types": [
          "tv",
          "movie"
        ],
        "languages": [
          "fr"
        ],
        "icon": "https://animevostfr.org/wp-content/uploads/luffy-icon.jpg"
      },
      {
        "id": "gowaru-6-animesultra",
        "name": "AnimesUltra",
        "description": "Animes en streaming VOSTFR et VF.",
        "types": [
          "tv",
          "movie"
        ],
        "languages": [
          "fr"
        ],
        "icon": "https://animesultra.org/templates/animeultra/images/favicon.ico"
      },
      {
        "id": "gowaru-7-jetanimes",
        "name": "JetAnimes",
        "description": "Regarder vos animes en streaming sur JetAnimes.",
        "types": [
          "tv",
          "movie"
        ],
        "languages": [
          "fr"
        ],
        "icon": "https://vww.jetanimes.com/wp-content/uploads/2018/12/android-chrome-192x192.png"
      },
      {
        "id": "gowaru-8-sekai",
        "name": "Sekai",
        "description": "Fournisseur spécialisé sur les gros animes. Streams directs très rapides sans iFrames.",
        "types": [
          "tv",
          "movie"
        ],
        "languages": [
          "fr"
        ],
        "icon": "https://sekai.one/favicon.ico"
      }
    ]
  },
  {
    "id": "nuvio-mooncrown04-9",
    "name": "MoonCrown",
    "author": "mooncrown04",
    "description": "Turkish content manifest for Nuvio.",
    "tags": [
      "Turkish"
    ],
    "types": [
      "movie",
      "tv"
    ],
    "languages": [
      "tr"
    ],
    "manifestUrl": "https://raw.githubusercontent.com/mooncrown04/nuviotr/refs/heads/main/manifest.json",
    "plugins": [
      {
        "id": "mooncrown04-0-moonvidmodyfilmdizi",
        "name": "MoonVidmodyFilmDizi",
        "description": "En yeni filmleri güvenli ve hızlı şekilde sunar.",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "tr",
          "en"
        ],
        "icon": ""
      },
      {
        "id": "mooncrown04-1-mooncrownfilmm3u",
        "name": "MoOnCrOwNFilmM3U",
        "description": "PowerBoard, Zerk ve Lundeor kaynaklarından en yeni filmler.",
        "types": [
          "movie"
        ],
        "languages": [
          "tr"
        ],
        "icon": ""
      },
      {
        "id": "mooncrown04-2-mooncrowndizim3u",
        "name": "MoOnCrOwNDiziM3U",
        "description": "PowerBoard, Zerk kaynaklarından en yeni diziler.",
        "types": [
          "tv"
        ],
        "languages": [
          "tr"
        ],
        "icon": ""
      },
      {
        "id": "mooncrown04-3-m3u",
        "name": "M3u",
        "description": "M3u Film, Dizi İzleme",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "tr"
        ],
        "icon": ""
      },
      {
        "id": "mooncrown04-4-mooncrownm3u",
        "name": "MoOnCrOwN M3U",
        "description": "Otomatik M3U Katalog ve Yayın Eklentisi",
        "types": [
          "tv",
          "movie"
        ],
        "languages": [
          "tr"
        ],
        "icon": "https://play-lh.googleusercontent.com/brwGNmr7IjA_MKk_TTPs0va10hdKE_bD_a1lnKoiMuCayW98EHpRv55edA6aEoJlmwfX=w240-h480"
      },
      {
        "id": "mooncrown04-5-netmirror",
        "name": "NetMirror",
        "description": "Streaming links from netmirror (No iOS support).",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://net22.cc/favicon.ico"
      },
      {
        "id": "mooncrown04-6-sinemacx",
        "name": "SinemaCx",
        "description": "Film, Dizi İzleme Uygulaması",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "tr"
        ],
        "icon": ""
      },
      {
        "id": "mooncrown04-7-diziyou",
        "name": "DiziYou",
        "description": "En kaliteli Türkçe dublaj ve altyazılı yabancı dizi izleme sitesidir.",
        "types": [
          "tv"
        ],
        "languages": [
          "tr"
        ],
        "icon": ""
      },
      {
        "id": "mooncrown04-8-fullhdfilmizlesene",
        "name": "FullHdFilmizlesene",
        "description": "Türkçe film, dizi ve anime - 5000+ HD içerik archive.",
        "types": [
          "movie"
        ],
        "languages": [
          "tr"
        ],
        "icon": ""
      },
      {
        "id": "mooncrown04-9-sinewix",
        "name": "SineWix",
        "description": "Türkçe film, dizi ve anime - 5000+ HD içerik archive.",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "tr"
        ],
        "icon": "https://play-lh.googleusercontent.com/brwGNmr7IjA_MKk_TTPs0va10hdKE_bD_a1lnKoiMuCayW98EHpRv55edA6aEoJlmwfX=w240-h480"
      },
      {
        "id": "mooncrown04-10-rec",
        "name": "Rec",
        "description": "En yeni dizileri güvenli ve hızlı şekilde sunar.",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "tr"
        ],
        "icon": "https://rectvapp.com.tr/wp-content/uploads/2024/08/cropped-cropped-Screenshot_2023-08-31_at_11.02.55_PM-removebg-preview-32x32.webp"
      },
      {
        "id": "mooncrown04-11-jetfilmizle",
        "name": "JetFilmizle",
        "description": "Türkçe dublaj full HD filmler. Pixeldrain mp4 stream sağlar.",
        "types": [
          "movie"
        ],
        "languages": [
          "tr"
        ],
        "icon": "https://jetfilmizle.net/public/icons/apple-touch-icon.png"
      },
      {
        "id": "mooncrown04-12-sezonlukdizi",
        "name": "SezonlukDizi",
        "description": "Türkçe dublaj ve altyazılı diziler.",
        "types": [
          "tv"
        ],
        "languages": [
          "tr"
        ],
        "icon": ""
      },
      {
        "id": "mooncrown04-13-webteizle",
        "name": "WebteIzle",
        "description": "Türkçe dublaj ve altyazılı filmler. VidMoly/Sibnet stream sağlar.",
        "types": [
          "movie"
        ],
        "languages": [
          "tr"
        ],
        "icon": "https://webteizle3.xyz/images/logo.png"
      },
      {
        "id": "mooncrown04-14-filmmodu",
        "name": "FilmModu",
        "description": "Türkçe dublaj ve altyazılı full HD filmler.",
        "types": [
          "movie"
        ],
        "languages": [
          "tr"
        ],
        "icon": "https://filmmodu.rip/wp-content/uploads/2023/07/logo.png"
      },
      {
        "id": "mooncrown04-15-altiyuzaltmisaltifilm",
        "name": "AltiYuzAltmisAltiFilm",
        "description": "Türkçe Dublaj ve Altyazılı Film izle",
        "types": [
          "movie"
        ],
        "languages": [
          "tr"
        ],
        "icon": ""
      },
      {
        "id": "mooncrown04-16-cinemacity",
        "name": "CinemaCity",
        "description": "Multi Language Provider",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en",
          "hi",
          "ar",
          "tr"
        ],
        "icon": "https://i.postimg.cc/XYjKhS3b/cinemacity.png"
      },
      {
        "id": "mooncrown04-17-vidlink",
        "name": "Vidlink",
        "description": "Vidlink streaming with encrypted TMDB ID",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "en"
        ],
        "icon": "https://vidlink.pro/favicon.ico"
      }
    ]
  },
  {
    "id": "nuvio-kennethjys-10",
    "name": "KennethJYS",
    "author": "KennethJYS",
    "description": "Latino content manifest from KennethJYS.",
    "tags": [
      "Latino"
    ],
    "types": [
      "movie",
      "tv"
    ],
    "languages": [
      "es"
    ],
    "manifestUrl": "https://raw.githubusercontent.com/KennethJYS/Nuvio-Providers-Latino/refs/heads/main/manifest.json",
    "plugins": [
      {
        "id": "kennethjys-0-lamovie",
        "name": "LaMovie",
        "description": "Streams en Latino/Español desde LaMovie. Vimeos, GoodStream, etc.",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "es"
        ],
        "icon": ""
      },
      {
        "id": "kennethjys-1-cinecalidad",
        "name": "CineCalidad",
        "description": "Películas en Latino desde CineCalidad.",
        "types": [
          "movie"
        ],
        "languages": [
          "es"
        ],
        "icon": ""
      },
      {
        "id": "kennethjys-2-embed69",
        "name": "Embed69",
        "description": "Streams en Latino/Español/Subtitulado desde Embed69.",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "es"
        ],
        "icon": ""
      },
      {
        "id": "kennethjys-3-zoowomaniacos",
        "name": "Zoowomaniacos",
        "description": "Películas de culto, cine de autor y difíciles de encontrar.",
        "types": [
          "movie"
        ],
        "languages": [
          "es"
        ],
        "icon": ""
      },
      {
        "id": "kennethjys-4-xupalace",
        "name": "Xupalace",
        "description": "Streams en Latino desde Xupalace.",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "es"
        ],
        "icon": ""
      },
      {
        "id": "kennethjys-5-seriesmetro",
        "name": "SeriesMetro",
        "description": "Streams en Latino desde SeriesMetro.",
        "types": [
          "movie",
          "tv"
        ],
        "languages": [
          "es"
        ],
        "icon": ""
      }
    ]
  },
  {
    "id": "nuvio-hindi-d3adlyrocket",
    "name": "Hindi-Nuvio",
    "author": "D3adlyRocket",
    "description": "Dedicated Hindi, Bollywood & Dual-Audio Nuvio plugin repository.",
    "tags": [
      "Hindi",
      "Dual Audio"
    ],
    "types": [
      "movie",
      "tv"
    ],
    "languages": [
      "hi",
      "en"
    ],
    "manifestUrl": "https://raw.githubusercontent.com/D3adlyRocket/Hindi-Nuvio/refs/heads/main/manifest.json",
    "plugins": [
      {
        "id": "hindi-nuvio-4khdhub",
        "name": "4KHDHub",
        "description": "Direct high-bitrate Hindi & Dual-Audio mirrors.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "hindi-nuvio-allmovieland",
        "name": "AllMovieLand",
        "description": "Hindi & Multi-language Bollywood and Hollywood dubbed streams.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "hindi-nuvio-cinemacity",
        "name": "CinemaCity",
        "description": "Fast Hindi web series and latest movie mirrors.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "hindi-nuvio-cinestream",
        "name": "CineStream",
        "description": "Direct Hindi & Bollywood stream index.",
        "types": ["movie", "tv"],
        "languages": ["hi"]
      },
      {
        "id": "hindi-nuvio-flixindia",
        "name": "FlixIndia",
        "description": "Indian OTT & Bollywood high speed streams.",
        "types": ["movie", "tv"],
        "languages": ["hi"]
      },
      {
        "id": "hindi-nuvio-hindmoviez",
        "name": "HindMoviez",
        "description": "Direct Hindi movies and dual-audio collections.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "hindi-nuvio-hdmovie2",
        "name": "HDMovie2",
        "description": "High resolution Hindi movies & web series.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "hindi-nuvio-moviebox",
        "name": "MovieBox",
        "description": "Hindi, Dual-Audio & HD direct mirrors.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "hindi-nuvio-movieblast",
        "name": "MovieBlast",
        "description": "High-bitrate Bollywood & Hindi dubbed releases.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "hindi-nuvio-moviesdrive",
        "name": "MoviesDrive",
        "description": "Ultra fast Google Drive & Cloud Hindi links.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "hindi-nuvio-movies4u",
        "name": "Movies4U",
        "description": "Hindi & multi-audio movies and series.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "hindi-nuvio-netmirror",
        "name": "NetMirror",
        "description": "Fast Hindi & Multi-Audio OTT HLS streams.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "hindi-nuvio-streamflix",
        "name": "StreamFlix",
        "description": "Direct Hindi API streams with high reliability.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "hindi-nuvio-vegamovies",
        "name": "VegaMovies",
        "description": "Top Hindi & Dual-Audio direct cloud mirrors.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      }
    ]
  },
  {
    "id": "nuvio-cb-providers",
    "name": "CB-Providers",
    "author": "SA7ANI",
    "description": "Verified Hindi & multi-audio OTT scrapers (NetMirror, Castle, MovieBox, DesiFlix, VegaMovies, MoviesDrive).",
    "tags": [
      "Hindi",
      "Multi language"
    ],
    "types": [
      "movie",
      "tv"
    ],
    "languages": [
      "hi",
      "en"
    ],
    "manifestUrl": "https://raw.githubusercontent.com/SA7ANI/cb-providers/main/manifest.json",
    "plugins": [
      {
        "id": "cb-moviesdrive",
        "name": "MoviesDrive",
        "description": "Direct Hindi & Dual-Audio high speed streams.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "cb-4khdhub",
        "name": "4KHDHub",
        "description": "Direct 4K and 1080p Hindi mirrors.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "cb-hdhub4u",
        "name": "HDHub4u",
        "description": "Hindi dubbed & Bollywood movies in 1080p/4K.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "cb-vegamovies",
        "name": "VegaMovies",
        "description": "Hindi & Dual-Audio direct cloud streams.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "cb-castle",
        "name": "Castle",
        "description": "Hindi dubbed & English direct MP4/HLS streams.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "cb-desiflix",
        "name": "DesiFlix",
        "description": "Dedicated Hindi & Bollywood movie and series scraper.",
        "types": ["movie", "tv"],
        "languages": ["hi"]
      },
      {
        "id": "cb-moviebox",
        "name": "MovieBox",
        "description": "Hindi, Dual-Audio & HD direct mirrors.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "cb-moviesmod",
        "name": "MoviesMod",
        "description": "Hindi movies and web series with multiple quality options.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "cb-playimdb",
        "name": "PlayIMDb",
        "description": "Hindi & Indian regional streaming mirrors.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "cb-netmirror",
        "name": "NetMirror",
        "description": "Fast Hindi & Multi-Audio OTT HLS streams.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "cb-multimovies",
        "name": "MultiMovies",
        "description": "Hindi, Dual-Audio & South Indian Hindi dubbed streams.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "cb-toonstream",
        "name": "ToonStream",
        "description": "Hindi cartoons, anime & animated series.",
        "types": ["movie", "tv"],
        "languages": ["hi"]
      },
      {
        "id": "cb-puretoons",
        "name": "PureToons",
        "description": "Hindi dubbed classic & modern animated shows.",
        "types": ["movie", "tv"],
        "languages": ["hi"]
      },
      {
        "id": "cb-einthusan",
        "name": "Einthusan",
        "description": "Premium South Indian & Hindi high quality cinema.",
        "types": ["movie", "tv"],
        "languages": ["hi", "ta", "te"]
      },
      {
        "id": "cb-animeworld",
        "name": "AnimeWorld",
        "description": "Hindi dubbed anime and animated features.",
        "types": ["movie", "tv"],
        "languages": ["hi", "ja"]
      },
      {
        "id": "cb-animesalt",
        "name": "AnimeSalt",
        "description": "Hindi dub and sub anime streams.",
        "types": ["movie", "tv"],
        "languages": ["hi", "ja"]
      },
      {
        "id": "cb-cinecity",
        "name": "CineCity",
        "description": "Latest Bollywood movies and regional content.",
        "types": ["movie", "tv"],
        "languages": ["hi"]
      },
      {
        "id": "cb-movieblast",
        "name": "MovieBlast",
        "description": "Bollywood & Dual-Audio high speed releases.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "cb-allmovieland",
        "name": "AllMovieLand",
        "description": "Hindi & Hollywood dubbed full HD streams.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "cb-streamflix",
        "name": "StreamFlix",
        "description": "Direct Hindi streaming endpoints.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "cb-hindmoviez",
        "name": "HindMoviez",
        "description": "Hindi dubbed films and series.",
        "types": ["movie", "tv"],
        "languages": ["hi"]
      },
      {
        "id": "cb-topcartoons",
        "name": "TopCartoons",
        "description": "Hindi dubbed cartoon episodes and movies.",
        "types": ["movie", "tv"],
        "languages": ["hi"]
      },
      {
        "id": "cb-uhdmovies",
        "name": "UHDMovies",
        "description": "Ultra HD Hindi & multi-audio streams.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "cb-fibwatch",
        "name": "FibWatch",
        "description": "Hindi & Indian regional cinema mirrors.",
        "types": ["movie", "tv"],
        "languages": ["hi"]
      },
      {
        "id": "cb-hdghartv",
        "name": "HDGharTV",
        "description": "Hindi television serials and movie streams.",
        "types": ["movie", "tv"],
        "languages": ["hi"]
      },
      {
        "id": "cb-gramcinema",
        "name": "GramCinema",
        "description": "Hindi & desi movie releases.",
        "types": ["movie", "tv"],
        "languages": ["hi"]
      },
      {
        "id": "cb-ctgmovies",
        "name": "CTGMovies",
        "description": "Hindi dubbed Hollywood & Bollywood cinema.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      },
      {
        "id": "cb-peachify",
        "name": "Peachify",
        "description": "Fast multi-quality Hindi streaming mirrors.",
        "types": ["movie", "tv"],
        "languages": ["hi", "en"]
      }
    ]
  }
];

export const STREMIO_ADDONS_NET_DIRECTORY: StremioNetDirectoryAddon[] = [
  {
    "id": "stremionet-cncverse-bridge",
    "slug": "cncverse-bridge",
    "name": "CNCVerse Bridge (Hindi & Multi)",
    "manifestUrl": "https://bridge.cncverse.com/stremio/manifest.json",
    "description": "High-availability Hindi, Bollywood, Dual-Audio & Indian regional movie and series streams from CNCVerse.",
    "logo": "https://cncverse.com/icon.png",
    "category": "Hindi & Regional"
  },
  {
    "id": "stremionet-flix-free",
    "slug": "flix-free",
    "name": "Flix Free (Hindi Dubbed & Multi)",
    "manifestUrl": "https://flixfree.vercel.app/manifest.json",
    "description": "Free Hindi dubbed movies, Bollywood blockbusters, and dual-audio web series streams.",
    "logo": "https://flixfree.vercel.app/logo.png",
    "category": "Hindi & Regional"
  },
  {
    "id": "stremionet-mediafusion-hindi",
    "slug": "mediafusion-hindi",
    "name": "MediaFusion (Hindi & Multi-Audio)",
    "manifestUrl": "https://mediafusion.elfhosted.com/manifest.json",
    "description": "Universal Hindi, Bollywood, Tamil, Telugu, Malayalam & English multi-quality stream aggregator.",
    "logo": "https://mediafusion.elfhosted.com/static/logo.png",
    "category": "Hindi & Regional"
  },
  {
    "id": "stremionet-comet-feelslegal",
    "slug": "comet-feelslegal",
    "name": "Comet FeelsLegal (Hindi & Multi)",
    "manifestUrl": "https://comet.feelslegal.com/manifest.json",
    "description": "High-speed multi-quality P2P and web streams including Hindi, Dual-Audio and regional releases.",
    "logo": "https://comet.feelslegal.com/logo.png",
    "category": "Hindi & Regional"
  },
  {
    "id": "stremionet-ratings-aggregator",
    "slug": "ratings-aggregator",
    "name": "🎯 Ratings Aggregator",
    "manifestUrl": "https://rating-aggregator.elfhosted.com/manifest.json",
    "description": "Tired of tab-hopping? Get all your essential movie and series ratings in one place! Aggregates scores from IMDb, TMDb, Metacritic (critic & user), Common Sense Media, and CringeMDB (parent-safe tags). Streamline your wat",
    "logo": "https://emojicdn.elk.sh/%F0%9F%8E%AF?style=google",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-nuvio-live-sports",
    "slug": "nuvio-live-sports",
    "name": "🏆 Nuvio Live Sports",
    "manifestUrl": "https://nuviosports.xyz/manifest.json",
    "description": "The ultimate live sports aggregator. Stream live Football, NBA, NFL, NHL, F1, and more. Aggregates high-speed live streams and 24/7 sports TV networks with zero-lag playback.",
    "logo": "https://nuviosports.xyz/logo.png",
    "category": "Live TV & Sports"
  },
  {
    "id": "stremionet-absolute-cinema",
    "slug": "absolute-cinema",
    "name": "Absolute Cinema",
    "manifestUrl": "https://cinema.debrid.in/manifest.json",
    "description": "Movies, shows, anime, live TV and sports in one addon. Streams from 17 torrent sources and 13 debrid services, with P2P fallback. Direct HTTP sources sit in the same list. Filter by quality, size, seeders, audio and keyw",
    "logo": "https://cinema.debrid.in/static/absolute-cinema-logo.svg?v=1.118.14",
    "category": "Live TV & Sports"
  },
  {
    "id": "stremionet-ai-search",
    "slug": "ai-search",
    "name": "AI Search",
    "manifestUrl": "https://stremio.tomz.dev/aisearch/manifest.json",
    "description": "AI-powered movie and series recommendations",
    "logo": "https://stremio.tomz.dev/aisearch/logo.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-aiometadata-elfhosted",
    "slug": "aiometadata-elfhosted",
    "name": "AIO Metadata",
    "manifestUrl": "https://aiometadata.elfhosted.com/manifest.json",
    "description": "A metadata addon for power users. AIOMetadata uses TMDB, TVDB, TVMaze, MyAnimeList, IMDB and Fanart.tv to provide accurate data for movies, series, and anime. You choose the source.",
    "logo": "https://aiometadata.elfhosted.com/logo.png",
    "category": "Anime"
  },
  {
    "id": "stremionet-aio-subtitle-pro",
    "slug": "aio-subtitle-pro",
    "name": "AIO Subtitle PRO",
    "manifestUrl": "https://api.aiosubtitle.org/stremio/manifest.json",
    "description": "Subtitle addon using OpenSubtitles PRO, OpenAI for context-aware subtitle translations, Bilingual and SDH support. Visit https://aiosubtitle.org to easily download subtitles.",
    "logo": "https://api.aiosubtitle.org/assets/logo.webp",
    "category": "Subtitles"
  },
  {
    "id": "stremionet-aiolists",
    "slug": "aiolists",
    "name": "AIOLists",
    "manifestUrl": "https://aiolists.elfhosted.com/manifest.json",
    "description": "Manage all your lists in one place.",
    "logo": "https://i.imgur.com/DigFuAQ.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-aiostreams",
    "slug": "aiostreams",
    "name": "AIOStreams",
    "manifestUrl": "https://aiostreams.elfhosted.com/stremio/manifest.json",
    "description": "AIOStreams brings your Stremio addons, debrid services and Usenet together into one list, filtered, sorted and formatted your way, and plays it in Stremio or in its own apps for every screen.",
    "logo": "https://raw.githubusercontent.com/Viren070/AIOStreams/refs/heads/main/packages/frontend/public/logo.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-all-iptv",
    "slug": "all-iptv",
    "name": "All IPTV",
    "manifestUrl": "https://fun.lnpx.workers.dev/manifest.json",
    "description": "Watch 12,000+ daily updated premium IPTV channels in English, Spanish, Russian, French, German, Hindi, Chinese and other languages. Explore categories like Movies, Series, Sports, Cooking, Music, Anime and other genres. ",
    "logo": "https://fun.lnpx.workers.dev/logo.webp",
    "category": "Live TV & Sports"
  },
  {
    "id": "stremionet-anime-catalogs",
    "slug": "anime-catalogs",
    "name": "Anime Catalogs",
    "manifestUrl": "https://1fe84bc728af-stremio-anime-catalogs.baby-beamup.club/manifest.json",
    "description": "Stremio catalogs for anime from: MyAnimeList, AniDB, AniList, Kitsu, aniSearch, LiveChart.me, Notify.Moe. Also supports filtering by dubbed and optional setting to use Rating Posters from RPDB.",
    "logo": "https://1fe84bc728af-stremio-anime-catalogs.baby-beamup.club/addon-logo.png",
    "category": "Anime"
  },
  {
    "id": "stremionet-anime-kitsu",
    "slug": "anime-kitsu",
    "name": "Anime Kitsu",
    "manifestUrl": "https://anime-kitsu.strem.fun/manifest.json",
    "description": "Unofficial Kitsu.io anime catalog addon",
    "logo": "https://i.imgur.com/7N6XGoO.png",
    "category": "Anime"
  },
  {
    "id": "stremionet-animee",
    "slug": "animee",
    "name": "Animee",
    "manifestUrl": "https://animee.stravo.site/local/manifest.json",
    "description": "Stream anime movies and tv-series from all around the world",
    "logo": "https://cdn.stravo.site/7/img/logo.png",
    "category": "Anime"
  },
  {
    "id": "stremionet-animeo",
    "slug": "animeo",
    "name": "animeo",
    "manifestUrl": "https://7a625ac658ec-animeo.baby-beamup.club/manifest.json",
    "description": "Track your anime progress with anilist while using stremio.",
    "logo": "https://raw.githubusercontent.com/Jenrykster/animeo/main/logo.png",
    "category": "Anime"
  },
  {
    "id": "stremionet-animeflv",
    "slug": "animeflv",
    "name": "AnimES",
    "manifestUrl": "https://pigamer37.alwaysdata.net/manifest.json",
    "description": "Add AnimeAV1, Henaojara, TioAnime, Latanime & Apotoxin Fansub functionallity to Stremio, including catalogs, streams and metadata, even showing upcoming episodes in the calendar! Not affiliated with AnimeAV1, Henaojara, ",
    "logo": "https://raw.githubusercontent.com/Pigamer37/animeflv-stremio-addon/refs/heads/main/views/AnimES.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-animestream",
    "slug": "animestream",
    "name": "AnimeStream",
    "manifestUrl": "https://animestream-addon.keypop3750.workers.dev/manifest.json",
    "description": "All your favorite Anime series and movies with filtering by genre, seasonal releases, currently airing and ratings.",
    "logo": "https://raw.githubusercontent.com/Zen0-99/animestream-addon/master/public/logo.png",
    "category": "Anime"
  },
  {
    "id": "stremionet-nyaa-scraper-stremio",
    "slug": "nyaa-scraper-stremio",
    "name": "AniScraper",
    "manifestUrl": "https://c5541ffce7d3-aniscraper.baby-beamup.club/manifest.json",
    "description": "Stream anime directly from Nyaa, AnimeTosho, AniRena, or TsukiHime. Configure a debrid service for instant streaming. Visit /configure to set up.",
    "logo": "https://raw.githubusercontent.com/vanomarb/ani-scraper-stremio-addon/refs/heads/main/assets/aniscraper-logo.png",
    "category": "Anime"
  },
  {
    "id": "stremionet-arabcity",
    "slug": "arabcity",
    "name": "ArabCity",
    "manifestUrl": "https://arabcity.fly.dev/manifest.json",
    "description": "استمتع بمكتبة ضخمة من الأفلام والمسلسلات العربية",
    "logo": "https://h.top4top.io/p_3660e08ap1.jpg",
    "category": "Streams"
  },
  {
    "id": "stremionet-asian-tv",
    "slug": "asian-tv",
    "name": "Asian",
    "manifestUrl": "https://k-drama-kq1pjckm.on-forge.com/manifest.json",
    "description": "Discover Asian TV shows and movies. Catalog-only addon - use with your streaming addons (Torrentio, etc.)",
    "logo": "https://k-drama-kq1pjckm.on-forge.com/logo.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-streamio-auto-subs",
    "slug": "streamio-auto-subs",
    "name": "Auto",
    "manifestUrl": "https://streamio.auto-subs.com/1d33f2ea06c94470074ceb8b/manifest.json",
    "description": "Stremio Subtitles Addon: AI translation of any movie or series into 30+ languages, timing untouched, no ads in subtitles. Works on Stremio, Kodi and Nuvio.",
    "logo": "https://auto-subs.com/assets/logo.png?v=2",
    "category": "Subtitles"
  },
  {
    "id": "stremionet-betor-v3-oficial",
    "slug": "betor-v3-oficial",
    "name": "BeTor v3 Oficial",
    "manifestUrl": "https://stremio-betor.onrender.com/manifest.json",
    "description": "Busca de torrents brasileiros do BeTor",
    "logo": "",
    "category": "Streams"
  },
  {
    "id": "stremionet-bharat-binge",
    "slug": "bharat-binge",
    "name": "Bharat Binge",
    "manifestUrl": "https://bharat-binge.semi-column.workers.dev/manifest.json",
    "description": "Discover Indian content - Top 10 charts from Netflix, Prime Video, ZEE5, JioHotstar + Hindi, Tamil, Telugu & more regional catalogs",
    "logo": "https://bharat-binge.semi-column.workers.dev/logo.png",
    "category": "Hindi & Regional"
  },
  {
    "id": "stremionet-bingecat-ai-search-catalog-manager",
    "slug": "bingecat-ai-search-catalog-manager",
    "name": "Bingecat AI Assistant",
    "manifestUrl": "https://bingecat.com/stremio/manifest.json",
    "description": "AI-powered movie and series catalogs from Bingecat. Log in to configure your personal addon before installation.",
    "logo": "https://bingecat.com/static/logo.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-bollywood-streams",
    "slug": "bollywood-streams",
    "name": "Bollywood Streams",
    "manifestUrl": "https://bollywood-streams.onrender.com/manifest.json",
    "description": "Browse Hindi, Punjabi & South Indian dubbed movies (popular, top rated, new, by genre) and stream them via public torrents.",
    "logo": "https://raw.githubusercontent.com/inzamamraj-netizen/bollywood-streams/main/logo.png",
    "category": "Hindi & Regional"
  },
  {
    "id": "stremionet-brazuca-torrents",
    "slug": "brazuca-torrents",
    "name": "Brazuca Torrents",
    "manifestUrl": "https://94c8cb9f702d-brazuca-torrents.baby-beamup.club/manifest.json",
    "description": "Fornece streams de filmes e series dublados de provedores de torrent. Suporta atualmente ApacheTorrent(+), BaixaFilmesTorrentHD(+), EraiRaws(+), HDRTorrent(+), NyaaSi(+), RedeTorrent(+), VacaTorrent(+). (This addon was m",
    "logo": "https://i.imgur.com/KVpfrAk.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-canales-deportivos",
    "slug": "canales-deportivos",
    "name": "Canales Deportivos",
    "manifestUrl": "https://139c618fc3f4-canales-deportivos.baby-beamup.club/manifest.json",
    "description": "Canales deportivos en vivo (actualizado julio 2026)",
    "logo": "https://upload.wikimedia.org/wikipedia/commons/2/2f/ESPN_wordmark.svg",
    "category": "Streams"
  },
  {
    "id": "stremionet-cartoon-network",
    "slug": "cartoon-network",
    "name": "Cartoon Network",
    "manifestUrl": "https://e1fc7808b5de-stremio-cartoon-network.baby-beamup.club/manifest.json",
    "description": "The Cartoon Network Stremio Addon lets you stream a wide range of Cartoon Network shows directly within Stremio. It’s a community-made, unofficial addon.",
    "logo": "https://raw.githubusercontent.com/johnchrisdc/stremio-cartoon-network/refs/heads/main/potato-inc.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-cinetorrent",
    "slug": "cinetorrent",
    "name": "CineTorrent",
    "manifestUrl": "https://150203dd784e-cinetorrent-addon.baby-beamup.club/manifest.json",
    "description": "Find Multi Language Torrent Streams for Movies and TV Shows supports (Brazilian Portuguese and English) - (TV Shows Support Comming Soon)",
    "logo": "https://i.ibb.co/RDtR0q0/Logo.jpg",
    "category": "Streams"
  },
  {
    "id": "stremionet-cncverse-bridge-streams",
    "slug": "cncverse-bridge",
    "name": "CNCVerse Bridge",
    "manifestUrl": "https://cncverse.dpdns.org/manifest.json",
    "description": "Cloudstream plugin bridge for Stremio — Developed by NivinCNC",
    "logo": "https://raw.githubusercontent.com/NivinCNC/CNCVerse-Bridge/refs/heads/main/logo.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-comet",
    "slug": "comet",
    "name": "Comet",
    "manifestUrl": "https://comet.elfhosted.com/manifest.json",
    "description": "Stremio&#x27;s fastest torrent/debrid search add-on.",
    "logo": "https://i.imgur.com/jmVoVMu.jpeg",
    "category": "Streams"
  },
  {
    "id": "stremionet-cometnet-elfhosted",
    "slug": "cometnet-elfhosted",
    "name": "CometNet",
    "manifestUrl": "https://cometnet.elfhosted.com/manifest.json",
    "description": "Stremio&#x27;s fastest torrent/debrid search add-on.",
    "logo": "https://raw.githubusercontent.com/g0ldyy/comet/refs/heads/main/comet/assets/icon.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-content-deep-dive-companion",
    "slug": "content-deep-dive-companion",
    "name": "Content Deep Dive Companion",
    "manifestUrl": "https://stremio-content-deepdive-addon-dc8f7b513289.herokuapp.com/manifest.json",
    "description": "A comprehensive companion addon that provides detailed content information, cast details, reviews, and production insights for movies and series.",
    "logo": "https://stremio-content-deepdive-addon-dc8f7b513289.herokuapp.com/DeepDiveLogo.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-debrid-search",
    "slug": "debrid-search",
    "name": "Debrid Search",
    "manifestUrl": "https://68d69db7dc40-debrid-search.baby-beamup.club/manifest.json",
    "description": "Stremio Addon to search downloads and torrents in your Debrid cloud",
    "logo": "https://img.icons8.com/fluency/256/search-in-cloud.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-fayatv",
    "slug": "fayatv",
    "name": "FayaTV",
    "manifestUrl": "https://fayatv.stravo.site/d/manifest.json",
    "description": "IPTV channels from every country and live-sports",
    "logo": "https://cdn.stravo.site/8/img/logo.new.t.png",
    "category": "Live TV & Sports"
  },
  {
    "id": "stremionet-fenixflix",
    "slug": "fenixflix",
    "name": "FenixFlix",
    "manifestUrl": "https://fenixflix.fenixhub.online/manifest.json",
    "description": "Addon de filmes, séries, novelas, doramas e animes dublados e legendados em português (PT-BR), com conteúdos em qualidade HD e 4K",
    "logo": "https://files.catbox.moe/mtoh35.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-filtorrent",
    "slug": "filtorrent",
    "name": "Filtorrent",
    "manifestUrl": "https://ce8c71dcef3b-filtorrent.baby-beamup.club/manifest.json",
    "description": "Merges Torrentio + TorrentsDB, then shapes the stream list: a must-match hard filter, a preferred soft sort, and an ordered sort priority. Layered cards with resolution badge. Works for movies and series/anime. Open Conf",
    "logo": "https://ce8c71dcef3b-filtorrent.baby-beamup.club/logo.svg",
    "category": "Anime"
  },
  {
    "id": "stremionet-flix-streams",
    "slug": "flix-streams",
    "name": "Flix",
    "manifestUrl": "https://flixnest.app/flix-streams/manifest.json",
    "description": "Movies, series, anime, live TV, sports, 4K/REMUX sources, media libraries, and built-in subtitles in one Stremio addon.",
    "logo": "https://flixnest.app/flix-streams/static/icon.png",
    "category": "Subtitles"
  },
  {
    "id": "stremionet-flix-streams-free",
    "slug": "flix-streams-free",
    "name": "Flix",
    "manifestUrl": "https://free.flixnest.app/manifest.json",
    "description": "Free Flix-Streams addon with HDHub, HDHub4u, Dailymotion, and DLStreams Live TV/Sports.",
    "logo": "https://free.flixnest.app/static/favicon.svg",
    "category": "Live TV & Sports"
  },
  {
    "id": "stremionet-froststream",
    "slug": "froststream",
    "name": "FrostStream",
    "manifestUrl": "https://froststream.cloutteam.com/manifest.json",
    "description": "Filmes e séries com reprodução rapida, multiplas fontes para assistir, e sobretudo sem travamentos e com ótima qualidade. Aproveite sem interrupções.",
    "logo": "https://i.imgur.com/yuG0ZIU.jpeg",
    "category": "Streams"
  },
  {
    "id": "stremionet-gtsubs",
    "slug": "gtsubs",
    "name": "GTSubs",
    "manifestUrl": "https://gtsubs.strem.top/manifest.json",
    "description": "Auto-translate subtitles using Google Translate",
    "logo": "https://raw.githubusercontent.com/nexusdiscord/tv-logo/master/gt.png",
    "category": "Subtitles"
  },
  {
    "id": "stremionet-hdhub",
    "slug": "hdhub",
    "name": "HdHub",
    "manifestUrl": "https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9/manifest.json",
    "description": "Watch Hindi, Dual-Audio & multi-language movies and series from HdHub.",
    "logo": "http://hdhub.thevolecitor.qzz.io/logo.png",
    "category": "Hindi & Regional"
  },
  {
    "id": "stremionet-hianime-streams",
    "slug": "hianime-streams",
    "name": "HiAnime Streams",
    "manifestUrl": "https://streamio-hianime.onrender.com/manifest.json",
    "description": "Stream your anime from the AniWatch API",
    "logo": "https://hianime.to/favicon.ico",
    "category": "Anime"
  },
  {
    "id": "stremionet-hoofoot",
    "slug": "hoofoot",
    "name": "Hoofoot",
    "manifestUrl": "https://hoofoot.stravo.site/d/manifest.json",
    "description": "Live soccer and highlights for EPL, Championship, Serie A, Laliga, Bundesliga, Ligue 1 among other leagues/cup",
    "logo": "https://cdn.stravo.site/9/img/logo.png",
    "category": "Live TV & Sports"
  },
  {
    "id": "stremionet-horror",
    "slug": "horror",
    "name": "Horror",
    "manifestUrl": "https://horror.debrid.in/manifest.json",
    "description": "Every kind of scary, sorted. Build your own horror shelf from 20 subgenres (slasher, folk horror, giallo and more), seven decades from the 60s on, 20 franchises, horror on 12 streaming services and 17 special rows like T",
    "logo": "https://horror.debrid.in/static/horror-icon.svg?v=1.118.14",
    "category": "Streams"
  },
  {
    "id": "stremionet-hyper",
    "slug": "hyper",
    "name": "Hyper",
    "manifestUrl": "https://hyper.stravo.site/local/manifest.json",
    "description": "Provides fast streams for movies and tv-series",
    "logo": "https://cdn.stravo.site/5/img/logo.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-ilcorsaroviola",
    "slug": "ilcorsaroviola",
    "name": "IlCorsaroViola",
    "manifestUrl": "https://icv.stremio-italia.eu/manifest.json",
    "description": "Streaming da UIndex, CorsaroNero DB local, Knaben e Jackettio con o senza Real-Debrid, Torbox e Alldebrid.",
    "logo": "https://i.imgur.com/kZK4KKS.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-imdb-catalogs",
    "slug": "imdb-catalogs",
    "name": "IMDB Catalogs",
    "manifestUrl": "https://1fe84bc728af-imdb-catalogs.baby-beamup.club/manifest.json",
    "description": "IMDB Movie and Series lists. Supports optional settings to use Rating Posters from RPDB.",
    "logo": "https://londonfeministfilmfestival.files.wordpress.com/2017/05/imdb-logo.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-imdb-ratings",
    "slug": "imdb-ratings",
    "name": "IMDb Ratings",
    "manifestUrl": "https://imdbratings.kgenovz.com/manifest.json",
    "description": "Shows IMDb ratings for movies and individual TV episodes with a completely configurable format. Works with anime.",
    "logo": "https://raw.githubusercontent.com/kgenovz/stremio-ratings-v3/main/logo.png",
    "category": "Anime"
  },
  {
    "id": "stremionet-intell-debridsearch",
    "slug": "intell-debridsearch",
    "name": "Intelligent Debrid Search",
    "manifestUrl": "https://intell-debridsearch.nepiraw.com/manifest.json",
    "description": "A smarter Stremio add-on to search downloads and torrents in your Debrid cloud.",
    "logo": "https://img.icons8.com/fluency/256/search-in-cloud.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-jackettio",
    "slug": "jackettio",
    "name": "Jackettio",
    "manifestUrl": "https://jackettio.elfhosted.com/manifest.json",
    "description": "Stremio addon that resolve streams using Jackett and Debrid. It seamlessly integrates with private trackers.",
    "logo": "",
    "category": "Streams"
  },
  {
    "id": "stremionet-k-dramas-binged",
    "slug": "k-dramas-binged",
    "name": "K",
    "manifestUrl": "https://83e20802dcf1-kdramacrush.baby-beamup.club/manifest.json",
    "description": "Get daily-updated catalog of the latest Korean Dramas and Japanese Dramas with curated user lists. All 4 Catalogs: K-dramas - Latest, Trending Kdramas - This Week, MyDramaList - Top KDramas All Time, Japanese Drama - Lat",
    "logo": "https://i.ibb.co/vxC9rTBZ/242-EB494-F0-D4-400-A-9931-C303251-F0-DAC.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-knightcrawler-elfhosted",
    "slug": "knightcrawler-elfhosted",
    "name": "KnightCrawler",
    "manifestUrl": "https://knightcrawler.elfhosted.com/manifest.json",
    "description": "KnightCrawler Community: torrent streams provided by popular trackers and DMM hashes",
    "logo": "https://elfhosted.com/images/logo.svg",
    "category": "Streams"
  },
  {
    "id": "stremionet-latinobrid",
    "slug": "latinobrid",
    "name": "Latinobrid",
    "manifestUrl": "https://latinobrid.stremx.net/manifest.json",
    "description": "Tus películas y series en español latino, en la mejor calidad!",
    "logo": "https://latinobrid.stremx.net/logo.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-m3uepg-tv-addon",
    "slug": "m3uepg-tv-addon",
    "name": "M3U/EPG TV Addon",
    "manifestUrl": "https://stiptv.ddns.me/eyJwcm92aWRlciI6ImRpcmVjdCIsIm0zdVVybCI6Imh0dHBzOi8vaXB0di1vcmcuZ2l0aHViLmlvL2lwdHYvaW5kZXgubTN1IiwiZW5hYmxlRXBnIjpmYWxzZSwicHJlc2NhbiI6eyJlbnRyaWVzIjoxMDg2MiwiYXBwcm94VHYiOjEwNzUxLCJhcHByb3hNb3ZpZXMiOjExMSwiZXBnUHJvZ3JhbW1lcyI6MCwiZXBnQ2hhbm5lbHMiOjB9LCJpbnN0YW5jZUlkIjoiOGFmZDM0NTQtNjYyOS00YmE3LWE3ZWMtMDc3ZWY3OWUzNTBjIn0/manifest.json",
    "description": "IPTV addon with M3U, EPG & Xtream (JSON/M3U) + encrypted configs, LRU/Redis cache, cache toggle, EPG offset",
    "logo": "",
    "category": "Live TV & Sports"
  },
  {
    "id": "stremionet-marvel",
    "slug": "marvel",
    "name": "Marvel",
    "manifestUrl": "https://addon-marvel.gonp.deno.net/manifest.json",
    "description": "Watch the entire Marvel catalog! MCU and X-Men (chronologically organized), Movies, Series, and Animations!",
    "logo": "https://raw.githubusercontent.com/joaogonp/addon-marvel/main/public/assets/icon.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-marvel2",
    "slug": "marvel2",
    "name": "Marvel",
    "manifestUrl": "https://h-gate.site/marvel/manifest.json",
    "description": "Marvel in one place — every Marvel film and series, from the MCU saga (Iron Man to Avengers and beyond) to the Netflix Defenders, X-Men, Spider-Man, animated classics and more. Browse Marvel Movies and Marvel Series sepa",
    "logo": "https://h-gate.site/marvel-logo.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-mediafusion-elfhosted",
    "slug": "mediafusion-elfhosted",
    "name": "MediaFusion",
    "manifestUrl": "https://mediafusion.elfhosted.com/manifest.json",
    "description": "MediaFusion — universal torrent & debrid streaming addon for Stremio",
    "logo": "https://raw.githubusercontent.com/mhdzumair/MediaFusion/main/resources/images/mediafusion_logo.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-meteor-midnightignite",
    "slug": "meteor-midnightignite",
    "name": "Meteor",
    "manifestUrl": "https://meteorfortheweebs.midnightignite.me/stremio/manifest.json",
    "description": "Conservative, franchise-aware torrent matching.",
    "logo": "https://meteorfortheweebs.midnightignite.me/logo.png?v=2118cbc8c8589771",
    "category": "Streams"
  },
  {
    "id": "stremionet-meu-futebol",
    "slug": "meu-futebol",
    "name": "Meu Futebol",
    "manifestUrl": "https://meufutebol.oneplayhd.com/manifest.json",
    "description": "Canais de esportes ao vivo",
    "logo": "https://i.imgur.com/RvfwPSw.jpeg",
    "category": "Streams"
  },
  {
    "id": "stremionet-mico-leao-dublado",
    "slug": "mico-leao-dublado",
    "name": "Mico",
    "manifestUrl": "https://27a5b2bfe3c0-stremio-brazilian-addon.baby-beamup.club/manifest.json",
    "description": "Assista a FILMES dublados em português de GRAÇA! HD e FULLHD!",
    "logo": "https://i.ibb.co/YyPbHVT/icon.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-mist",
    "slug": "mist",
    "name": "Mist",
    "manifestUrl": "https://mist-sage.vercel.app/manifest.json",
    "description": "HTTP Addon for chinese content",
    "logo": "https://mist-sage.vercel.app/assets/icon.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-more-like-this",
    "slug": "more-like-this",
    "name": "More Like This",
    "manifestUrl": "https://bbab4a35b833-more-like-this.baby-beamup.club/manifest.json",
    "description": "Shows recommendations from various sources",
    "logo": "https://i.imgur.com/DHKJ7dT.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-muvibox",
    "slug": "muvibox",
    "name": "Muvibox",
    "manifestUrl": "https://muvibox.znzcloud.my.id/manifest.json",
    "description": "Movies, Series, Anime streams and substitles from Netflix, Disney+, Prime Video, Apple TV+, Paramount+, HBO Max, Crunchyroll, Vidio, etc. PRO version available on https://muvipro.inulpc.web.id/configure",
    "logo": "https://cdn-icons-png.flaticon.com/512/2809/2809590.png",
    "category": "Anime"
  },
  {
    "id": "stremionet-mytrakt-sync-elfhosted",
    "slug": "mytrakt-sync-elfhosted",
    "name": "MyTrakt Sync",
    "manifestUrl": "https://mytrakt.elfhosted.com/manifest.json",
    "description": "Access your Trakt.tv watchlists, collections, custom lists, trending content and calendars directly in Stremio. Seamlessly browse your personal movie and TV show catalogs with genre filtering and search capabilities, Ful",
    "logo": "https://mytrakt.elfhosted.com/logo.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-nexotv",
    "slug": "nexotv",
    "name": "NexoTV",
    "manifestUrl": "https://263f84288ddb-nexotv.baby-beamup.club/manifest.json",
    "description": "Stream your IPTV channels in Stremio",
    "logo": "https://raw.githubusercontent.com/joaosavi/nexotv/refs/heads/main/packages/frontend/public/assets/logo.svg",
    "category": "Live TV & Sports"
  },
  {
    "id": "stremionet-nickelodeon",
    "slug": "nickelodeon",
    "name": "Nickelodeon",
    "manifestUrl": "https://e1fc7808b5de-stremio-nickelodeon.baby-beamup.club/manifest.json",
    "description": "The Nickelodeon Stremio Addon brings your favorite Nickelodeon movies and series right to your screen.",
    "logo": "https://i.ibb.co/tPNK3nsC/potatonic.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-nuvio-streams",
    "slug": "nuvio-streams",
    "name": "Nuvio Streams",
    "manifestUrl": "https://nuviostreams.hayd.uk/manifest.json",
    "description": "Fast direct HTTP multi-language streams for movies & series without torrenting.",
    "logo": "https://styles.redditmedia.com/t5_fvvpco/styles/profileIcon_c8ye4t9j6x2g1.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-webstreamr-mbg",
    "slug": "webstreamrmbg",
    "name": "WebStreamrMBG",
    "manifestUrl": "https://87d6a6ef6b58-webstreamrmbg.baby-beamup.club/manifest.json",
    "description": "Direct HTTPS web streams for movies & TV series across multiple languages.",
    "category": "Streams"
  },
  {
    "id": "stremionet-omnicatalogs",
    "slug": "omnicatalogs",
    "name": "OmniCatalogs",
    "manifestUrl": "https://5cfe2edf73d5-omnicatalogs.baby-beamup.club/manifest.json",
    "description": "Every streaming platform&#x27;s catalog in one addon. Discover what&#x27;s popular, trending, and new on Netflix, Disney+, HBO Max, Prime Video, and many more — organized by country and language, with translated cover ar",
    "logo": "https://5cfe2edf73d5-omnicatalogs.baby-beamup.club/static/logo-256.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-one-pace-addon",
    "slug": "one-pace-addon",
    "name": "One Pace Addon",
    "manifestUrl": "https://fedew04.github.io/OnePaceStremio/manifest.json",
    "description": "OFFICIAL One Pace addon for Stremio (https://onepace.net/). Go to Discover -&gt; Series -&gt; One Pace to watch.",
    "logo": "https://i.pinimg.com/originals/4c/46/ee/4c46ee47e0710a6d928454f68fc4ee17.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-opensubtitles-pro",
    "slug": "opensubtitles-pro",
    "name": "opensubtitles PRO",
    "manifestUrl": "https://opensubtitlesv3-pro.dexter21767.com/manifest.json",
    "description": "ad-free and spam-free subtitles addon",
    "logo": "https://i.imgur.com/cGc1DXB.png",
    "category": "Subtitles"
  },
  {
    "id": "stremionet-opensubtitles-v3",
    "slug": "opensubtitles-v3",
    "name": "OpenSubtitles v3",
    "manifestUrl": "https://opensubtitles-v3.strem.io/manifest.json",
    "description": "OpenSubtitles v3 Addon for Stremio",
    "logo": "http://www.strem.io/images/addons/opensubtitles-logo.png",
    "category": "Subtitles"
  },
  {
    "id": "stremionet-orion",
    "slug": "orion",
    "name": "Orion",
    "manifestUrl": "https://5a0d1888fa64-orion.baby-beamup.club/manifest.json",
    "description": "Orion Stremio Addon, allows Orion-indexed torrent, usenet and hoster links to be played on Stremio. Cached links can be played with RealDebrid, AllDebrid, Debrid-Link, Premiumize or Offcloud. Torrents can be streamed wit",
    "logo": "https://orionoid.com/web/images/logo/logo256.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-peerflix",
    "slug": "peerflix",
    "name": "Peerflix",
    "manifestUrl": "https://peerflix.mov/manifest.json",
    "description": "Peerflix proporciona los mejores enlaces en español e inglés de películas y series de TV en Stremio. Para configurar proveedores de chache, RealDebrid/Premiumize/AllDebrid/DebridLink/Offcloud/Put.io/Torbox visita https:/",
    "logo": "https://peerflix.mov/static/logo.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-penguplay",
    "slug": "penguplay",
    "name": "PenguPlay",
    "manifestUrl": "https://pengu.uk/manifest.json",
    "description": "Stream movies and series in Stremio with configurable provider and quality filters.",
    "logo": "https://pengu.uk/penguplay-icon.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-pipe",
    "slug": "pipe",
    "name": "Pipe",
    "manifestUrl": "https://pipe.boringways.workers.dev/manifest.json",
    "description": "All your streams in one pipe.",
    "logo": "https://pipe.boringways.workers.dev/logo.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-plaviohd",
    "slug": "plaviohd",
    "name": "PlavioHD",
    "manifestUrl": "https://hd.plavio.site/manifest.json",
    "description": "Built for Plavio Media — works with Plavio and any other app that supports Stremio addons. HD movies, series and live sports over direct HTTPS, no torrents.",
    "logo": "https://hd.plavio.site/logo.svg",
    "category": "Live TV & Sports"
  },
  {
    "id": "stremionet-plexio",
    "slug": "plexio",
    "name": "Plexio",
    "manifestUrl": "https://plexio.stream/manifest.json",
    "description": "Play movies and series from plex.tv.",
    "logo": "",
    "category": "Streams"
  },
  {
    "id": "stremionet-pluto-tv",
    "slug": "pluto-tv",
    "name": "Pluto TV",
    "manifestUrl": "https://dev.nebulawp.org/stremio/pluto-tv-addon/manifest.json",
    "description": "Live Pluto TV channels with catalog and search support",
    "logo": "",
    "category": "Live TV & Sports"
  },
  {
    "id": "stremionet-ratings",
    "slug": "ratings",
    "name": "Ratings",
    "manifestUrl": "https://72059fbbd1e5-stremio-addon-ratings.baby-beamup.club/manifest.json",
    "description": "Display Scores & Age Ratings at the top of your streams in Stremio. Now completely free for everyone — display up to 8 Scores & 3 Age Ratings, Vote Counts, Color Markers, and Overall Rating. Please configure before insta",
    "logo": "http://72059fbbd1e5-stremio-addon-ratings.baby-beamup.club/configure/img/logo.jpg",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-torrentsdb",
    "slug": "torrentsdb",
    "name": "Reddit",
    "manifestUrl": "https://torrentsdb.com/manifest.json",
    "description": "Provides torrent streams from scraped torrent providers. Currently supports YTS(+), EZTV(+), 1337x(+), TorrentCSV(+), 1lou(+), Nyaa(+), Sk-CzTorrent(+), 1TamilBlasters(+), LimeTorrent(+), 1TamilMV(+), RARGB(+), Knaben(+)",
    "logo": "https://torrentsdb.com/icon.svg",
    "category": "Streams"
  },
  {
    "id": "stremionet-romania-iptv-addon",
    "slug": "romania-iptv-addon",
    "name": "Romania IPTV",
    "manifestUrl": "https://stremiptv.com/addon/manifest.json",
    "description": "Filme, seriale și TV live în română. Configure obligatoriu pe site: https://stremiptv.com/addon",
    "logo": "https://play-lh.googleusercontent.com/vTx7ZMpR4kwkuL6a_mXezgEi1ZvqfaFqdOJYXHfzIKdg8SuPERRkeLADNK5KdRPHzw=w240-h480-rw",
    "category": "Live TV & Sports"
  },
  {
    "id": "stremionet-rotten-tomatoes",
    "slug": "rotten-tomatoes",
    "name": "Rotten Tomatoes",
    "manifestUrl": "https://7a82163c306e-rottentomatoes.baby-beamup.club/manifest.json",
    "description": "Certified Fresh Movies to Stream at Home and Best TV Shows.",
    "logo": "https://upload.wikimedia.org/wikipedia/commons/4/45/Rotten_Tomatoes_alternative_logo.svg",
    "category": "Streams"
  },
  {
    "id": "stremionet-rpdb-catalogs",
    "slug": "rpdb-catalogs",
    "name": "RPDB Catalogs",
    "manifestUrl": "https://1fe84bc728af-rpdb.baby-beamup.club/manifest.json",
    "description": "Catalogs to accurately track new / popular / best releases, and add ratings from all popular rating websites to posters. Based on the RatingPosterDB API.",
    "logo": "https://1fe84bc728af-rpdb.baby-beamup.club/addon-logo.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-scyllapick",
    "slug": "scyllapick",
    "name": "ScyllaPick",
    "manifestUrl": "https://scyllapick.onrender.com/manifest.json",
    "description": "Merges and ranks streams from your other add-ons and tags them with one bingeGroup so auto-next keeps working.",
    "logo": "https://files.catbox.moe/jde10o.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-showbox",
    "slug": "showbox",
    "name": "Showbox",
    "manifestUrl": "https://showbox.codiv.dpdns.org/manifest.json",
    "description": "Watch movies & series from Showbox in 4K, 1080P, 720P, 480P. Direct HTTP streams, no torrent or debrid needed.",
    "logo": "https://showbox-addon.onrender.com/favicon.svg",
    "category": "Streams"
  },
  {
    "id": "stremionet-sootio",
    "slug": "sootio",
    "name": "Sootio",
    "manifestUrl": "https://sootio.elfhosted.com/manifest.json",
    "description": "Your ultimate debrid companion. Sootio intelligently searches your debrid services for cached torrents, using a smart, tiered scoring system to prioritize the highest quality streams first.",
    "logo": "data:image/svg+xml,%3Csvg xmlns=&#x27;http://www.w3.org/2000/svg&#x27; viewBox=&#x27;0 0 100 100&#x27;%3E%3Cdefs%3E%3ClinearGradient id=&#x27;grad&#x27; x1=&#x27;0%25&#x27; y1=&#x27;0%25&#x27; x2=&#x27;100%25&#x27; y2=&#x27;100%25&#x27;%3E%3Cstop offset=&#x27;0%25&#x27; style=&#x27;stop-color:%2364ffda;stop-opacity:1&#x27; /%3E%3Cstop offset=&#x27;100%25&#x27; style=&#x27;stop-color:%2300A7B5;stop-opacity:1&#x27; /%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath fill=&#x27;url(%23grad)&#x27; d=&#x27;M50,5 C74.85,5 95,25.15 95,50 C95,74.85 74.85,95 50,95 C35,95 22.33,87.6 15,76 C25,85 40,85 50,80 C60,75 65,65 65,50 C65,35 55,25 40,25 C25,25 15,40 15,50 C15,55 16,60 18,64 C8.5,58 5,45 5,50 C5,25.15 25.15,5 50,5 Z&#x27;/%3E%3C/svg%3E",
    "category": "Streams"
  },
  {
    "id": "stremionet-spanish-streams",
    "slug": "spanish-streams",
    "name": "Spanish Streams",
    "manifestUrl": "https://965d83ef8484-stremio-latino.baby-beamup.club/manifest.json",
    "description": "Películas y series con audio en español (latino, castellano o genérico). Catálogos y streams solo con fuentes que tengan audio en español.",
    "logo": "https://965d83ef8484-stremio-latino.baby-beamup.club/logo.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-sports-streams",
    "slug": "sports-streams",
    "name": "Sports Streams",
    "manifestUrl": "https://sports.highfly.dev/manifest.json",
    "description": "Live and upcoming sports matches — football, basketball, cricket, UFC, tennis, and more.",
    "logo": "https://cdn.highfly.to/logo.ico",
    "category": "Live TV & Sports"
  },
  {
    "id": "stremionet-star-wars-universe",
    "slug": "star-wars-universe",
    "name": "Star Wars Universe",
    "manifestUrl": "https://addon-star-wars-u9e3.onrender.com/manifest.json",
    "description": "Explore the Star Wars Universe by sagas, series, eras, and more!",
    "logo": "https://www.freeiconspng.com/uploads/logo-star-wars-png-4.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-stravo",
    "slug": "stravo",
    "name": "Stravo",
    "manifestUrl": "https://stravo.site/local/manifest.json",
    "description": "For movies and your favorite TV shows - with subtitles",
    "logo": "https://cdn.stravo.site/1/img/logo.png",
    "category": "Subtitles"
  },
  {
    "id": "stremionet-stravo-ii",
    "slug": "stravo-ii",
    "name": "Stravo II",
    "manifestUrl": "https://v2.stravo.site/local/manifest.json",
    "description": "Collections and streams of movies, tv series with audio dub of your choice",
    "logo": "https://cdn.stravo.site/2/img/logo.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-streailer-trailer-provider",
    "slug": "streailer-trailer-provider",
    "name": "Streailer",
    "manifestUrl": "https://streailer.elfhosted.com/manifest.json",
    "description": "Trailer provider with multi-language support. TMDB → YouTube fallback → TMDB en-US. Season recaps for TV series.",
    "logo": "https://i.imgur.com/F7dxBVt.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-streaming-catalogs",
    "slug": "streaming-catalogs",
    "name": "Streaming Catalogs",
    "manifestUrl": "https://7a82163c306e-stremio-netflix-catalog-addon.baby-beamup.club/manifest.json",
    "description": "Trending movies and series on Netflix, HBO Max, Disney+, Apple TV+ and more. Configure to choose your favourite services.",
    "logo": "https://play-lh.googleusercontent.com/TBRwjS_qfJCSj1m7zZB93FnpJM5fSpMA_wUlFDLxWAb45T9RmwBvQd5cWR5viJJOhkI",
    "category": "Streams"
  },
  {
    "id": "stremionet-streaming-catalogs-plus",
    "slug": "streaming-catalogs-plus",
    "name": "Streaming Catalogs Plus",
    "manifestUrl": "https://scplus.duckdns.org/manifest.json",
    "description": "Streaming Catalog Plus organizes general movies and series by platform (Netflix, Disney+, Prime Video, HBO Max, SkyShowtime and Crunchyroll), excluding kids content and adding initial-letter subcategories, region, langua",
    "logo": "https://scplus.duckdns.org/assets/scplus-stremio-neon-nova-5111.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-streamvix-elfhosted",
    "slug": "streamvix-elfhosted",
    "name": "StreamViX",
    "manifestUrl": "https://streamvix.hayd.uk/%7B%22tmdbApiKey%22%3A%22%22%2C%22mediaFlowProxyUrl%22%3A%22%22%2C%22mediaFlowProxyPassword%22%3A%22%22%2C%22animeunityEnabled%22%3A%22on%22%2C%22animesaturnEnabled%22%3A%22on%22%2C%22animeworldEnabled%22%3A%22on%22%7D/manifest.json",
    "description": "StreamViX addon con Vixsrc, Guardaserie, Altadefinizione, AnimeUnity, AnimeSaturn, AnimeWorld, Eurostreaming, TV ed Eventi Live",
    "logo": "https://i.imgur.com/sPamibn.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-streamx",
    "slug": "streamx",
    "name": "StreamX",
    "manifestUrl": "https://streamx.electron.al/manifest.json",
    "description": "UPDATE! Recreate with install name + salt and enable For you for a stable URL and personalized catalog. High-quality, filtered torrents from public indexers.",
    "logo": "https://streamx.electron.al/logo",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-stremboxd",
    "slug": "stremboxd",
    "name": "Stremboxd",
    "manifestUrl": "https://api.stremboxd.com/manifest.json",
    "description": "Letterboxd for Stremio: popular films, Top 250, watchlist, custom lists, genre & decade filters, and search. Configure at https://stremboxd.com. Everything here stays free. Supporting pays the hosting and adds automatic ",
    "logo": "https://api.stremboxd.com/logo.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-stremio-community-subtitles",
    "slug": "stremio-community-subtitles",
    "name": "Stremio Community Subtitles",
    "manifestUrl": "https://stremio-community-subtitles.top/manifest.json",
    "description": "Community-driven subtitle addon for Stremio with user accounts and uploading.",
    "logo": "https://stremio-community-subtitles.top/static/logo.png",
    "category": "Subtitles"
  },
  {
    "id": "stremionet-stremio-iptv-by-dexter21767",
    "slug": "stremio-iptv-by-dexter21767",
    "name": "Stremio IPTV by dexter21767",
    "manifestUrl": "https://ryann-devv.github.io/Stremio-IPTV/manifest.json",
    "description": "Addon for International (country specific) TV channels! Huge thanks for iptv.org and u/RootByte!",
    "logo": "https://i.imgur.com/982WZT3.png",
    "category": "Live TV & Sports"
  },
  {
    "id": "stremionet-stremio-liked",
    "slug": "stremio-liked",
    "name": "Stremio Liked",
    "manifestUrl": "https://likes.stremio.com/addons/liked/manifest.json",
    "description": "Official Stremio liked movies / series catalogs for your account",
    "logo": "https://likes.stremio.com/images/liked.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-stremio-stats",
    "slug": "stremio-stats",
    "name": "Stremio Stats",
    "manifestUrl": "https://stremiostats.stream/manifest.json",
    "description": "How many movies you’ve watched on Stremio, how many hours, your favourite genres, directors, days and times, and the list of all of them. Open \"Configure\" for the full dashboard.",
    "logo": "https://stremiostats.stream/logo.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-stremio-status",
    "slug": "stremio-status",
    "name": "Stremio Status",
    "manifestUrl": "https://addon.stremio-status.com/manifest.json",
    "description": "Shows health status of stremio addons & services",
    "logo": "https://addon.stremio-status.com/static/logo.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-stremthru-list",
    "slug": "stremthru-list",
    "name": "StremThru List",
    "manifestUrl": "https://stremthru.13377001.xyz/stremio/list/manifest.json",
    "description": "Stremio Addon for accessing Lists",
    "logo": "https://emojiapi.dev/api/v1/sparkles/256.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-stremthru-torz",
    "slug": "stremthru-torz",
    "name": "StremThru Torz",
    "manifestUrl": "https://stremthru.13377001.xyz/stremio/torz/manifest.json",
    "description": "Stremio Addon to access crowdsourced Torz",
    "logo": "https://emojiapi.dev/api/v1/sparkles/256.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-stremverse",
    "slug": "stremverse",
    "name": "StremVerse",
    "manifestUrl": "https://stremverse1.alwaysdata.net/manifest.json",
    "description": "Live Events, Replays and Highlights from StremVerse.",
    "logo": "https://storage.ko-fi.com/cdn/useruploads/8be649b0-3d7f-42fc-a516-e092fdc9ca65_8bb57f59-c58d-4129-8b99-0a5ae03c0b06.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-subdl-subtitles",
    "slug": "subdl-subtitles",
    "name": "SubDL Subtitles",
    "manifestUrl": "https://subdl.strem.top/manifest.json",
    "description": "Unofficial addon for getting subtitles from SubDL.com",
    "logo": "https://raw.githubusercontent.com/nexusdiscord/tv-logo/master/download.jpg",
    "category": "Subtitles"
  },
  {
    "id": "stremionet-submaker-elfhosted",
    "slug": "submaker-elfhosted",
    "name": "SubMaker",
    "manifestUrl": "https://submaker.elfhosted.com/addon/bedadbea77057c6e79adb38710386e3d/manifest.json",
    "description": "Configuration Error: Session token not found or expired. Please reconfigure the addon to continue using it.",
    "logo": "https://submaker.elfhosted.com/logo.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-subsense",
    "slug": "subsense",
    "name": "SubSense",
    "manifestUrl": "https://subsense.nepiraw.com/manifest.json",
    "description": "Subtitle aggregator that fetches subtitles in your selected languages from multiple sources including OpenSubtitles, SubDL, SubSource, AnimeTosho and more.",
    "logo": "https://i.imgur.com/FaDbQAp.png",
    "category": "Subtitles"
  },
  {
    "id": "stremionet-subsource-subtitles",
    "slug": "subsource-subtitles",
    "name": "SubSource Subtitles",
    "manifestUrl": "https://subsource.strem.top/manifest.json",
    "description": "Unofficial addon for getting subtitles from SubSource.net",
    "logo": "https://raw.githubusercontent.com/nexusdiscord/tv-logo/master/ss.png",
    "category": "Subtitles"
  },
  {
    "id": "stremionet-subtito",
    "slug": "subtito",
    "name": "Subtito",
    "manifestUrl": "https://subtito.com/manifest.json",
    "description": "AI translated subtitles in your language. Works with your own OpenRouter key.",
    "logo": "https://subtito.com/icons/web-app-manifest-512x512.png",
    "category": "Subtitles"
  },
  {
    "id": "stremionet-syncribullet",
    "slug": "syncribullet",
    "name": "syncribullet",
    "manifestUrl": "https://56bca7d190fc-syncribullet.baby-beamup.club/manifest.json",
    "description": "App that mixes your syncs",
    "logo": "https://github.com/aliyss/syncribullet/blob/master/public/android-chrome-192x192.png?raw=true",
    "category": "Streams"
  },
  {
    "id": "stremionet-the-movie-database-addon",
    "slug": "the-movie-database-addon",
    "name": "The Movie Database Addon",
    "manifestUrl": "https://94c8cb9f702d-tmdb-addon.baby-beamup.club/manifest.json",
    "description": "Stremio addon that provides rich metadata for movies and TV shows from TMDB, featuring customizable catalogs, multi-language support, favorites lists, watchlist, ratings, and IMDb integration. Current settings: Language:",
    "logo": "https://94c8cb9f702d-tmdb-addon.baby-beamup.club/logo.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-thepiratebay-catalog",
    "slug": "thepiratebay-catalog",
    "name": "ThePirateBay Catalog",
    "manifestUrl": "https://5db836ec3ef8-thepiratebay-ctl.baby-beamup.club/manifest.json",
    "description": "Addon providing a catalog and search from The Pirate Bay.",
    "logo": "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/i/02b4826d-e6a0-4129-8486-38b601edaa03/dcs8pfz-9e7d00ac-d2f7-4ff2-88cb-8466d383a96a.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-tmdb-collections",
    "slug": "tmdb-collections",
    "name": "TMDB Collections",
    "manifestUrl": "https://61ab9c85a149-tmdb-collections.baby-beamup.club/manifest.json",
    "description": "Addon lets you explore TMDB Collections, which are essentially grouped movie series. Discover collections featuring newly released movies or browse catalogs of popular and top-rated collections. You can filter by genre o",
    "logo": "https://github.com/youchi1/tmdb-collections/raw/main/Images/logo.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-toast-translator-elfhosted",
    "slug": "toast-translator-elfhosted",
    "name": "Toast Translator",
    "manifestUrl": "https://toast-translator.elfhosted.com/manifest.json",
    "description": "Translator for catalog addons!",
    "logo": "https://i.imgur.com/1904KDj.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-top-streaming",
    "slug": "top-streaming",
    "name": "TOP Streaming",
    "manifestUrl": "https://top-streaming.stream/manifest.json",
    "description": "Top 10 charts from 48 streaming platforms in 92 countries, refreshed every night, plus Letterboxd, MyAnimeList, Ranker, Shudder, IMDb and Simkl lists, a new list, director and actor every day or week, and your own lists.",
    "logo": "https://top-streaming.stream/logo.png?v=11fe8e0aed",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-top-x",
    "slug": "top-x",
    "name": "TOP X",
    "manifestUrl": "https://topx.stremio-italia.eu/manifest.json",
    "description": "Classifiche Top X con cover numerate HD per Nuvio & Stremio",
    "logo": "https://topx.stremio-italia.eu/icons/topx-badge.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-torrent-catalogs",
    "slug": "torrent-catalogs",
    "name": "Torrent Catalogs",
    "manifestUrl": "https://torrent-catalogs.strem.fun/manifest.json",
    "description": "Provides catalogs for movies/series/anime based on top seeded torrents. Requires Kitsu addon for anime.",
    "logo": "https://i.ibb.co/w4BnkC9/GwxAcDV.png",
    "category": "Anime"
  },
  {
    "id": "stremionet-torrentclaw-addon",
    "slug": "torrentclaw-addon",
    "name": "TorrentClaw",
    "manifestUrl": "https://torrentclaw.com/api/stremio/manifest.json",
    "description": "One addon instead of eight: streams, TMDB metadata, subtitles, anime IDs and debrid — all in one. Replaces Torrentio + Cinemeta + OpenSubtitles + Anime Kitsu. 30+ sources, every result AI-verified against the real file (",
    "logo": "https://torrentclaw.com/icon-512.png",
    "category": "Subtitles"
  },
  {
    "id": "stremionet-torrentio",
    "slug": "torrentio",
    "name": "Torrentio",
    "manifestUrl": "https://torrentio.strem.fun/manifest.json",
    "description": "Provides torrent streams from scraped torrent providers. Currently supports YTS(+), EZTV(+), RARBG(+), 1337x(+), ThePirateBay(+), KickassTorrents(+), TorrentGalaxy(+), MagnetDL(+), HorribleSubs(+), NyaaSi(+), TokyoTosho(",
    "logo": "https://torrentio.strem.fun/images/logo_v1.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-tvvio",
    "slug": "tvvio",
    "name": "Tvvio",
    "manifestUrl": "https://tvvio.megaembed-frost.workers.dev/manifest.json",
    "description": "Canais de TV ao vivo (Filmes e Séries, Variedades, Notícias, Esportes, Canais Abertos, Infantil e Religiosos) via Tvvio, com guia de programação (EPG). Relay HLS com headers do CDN + stream direto com proxyHeaders.",
    "logo": "https://c69e439124f3-tvvio.baby-beamup.club/logo.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-voteit",
    "slug": "voteit",
    "name": "VoteIt",
    "manifestUrl": "https://voteit.co.uk/VOTEIT/manifest.json",
    "description": "Pick what to watch together. Everyone votes on their phone, and the winners appear as a row on your Stremio home screen. Tap Configure to start or join a group.",
    "logo": "https://voteit.co.uk/voteit-icon-512.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-watch-next",
    "slug": "watch-next",
    "name": "Watch Next",
    "manifestUrl": "https://099757617587-watch-next.baby-beamup.club/manifest.json",
    "description": "Shows similar movies and series right below what you’re currently watching using TMDb recommendations.",
    "logo": "https://myth-115.github.io/Dummy1/logo.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-watchio-tv",
    "slug": "watchio-tv",
    "name": "Watchio.live TV",
    "manifestUrl": "https://watchio-addon.pages.dev/manifest.json",
    "description": "Free TV Channels from around the world.",
    "logo": "https://watchio-addon.pages.dev/logo.png",
    "category": "Live TV & Sports"
  },
  {
    "id": "stremionet-watchly",
    "slug": "watchly",
    "name": "Watchly",
    "manifestUrl": "https://watchly.elfhosted.com/manifest.json",
    "description": "Movie and series recommendations based on your Stremio library.",
    "logo": "https://raw.githubusercontent.com/TimilsinaBimal/Watchly/refs/heads/main/app/static/logo.png",
    "category": "Catalogs"
  },
  {
    "id": "stremionet-yastream",
    "slug": "yastream",
    "name": "yastream",
    "manifestUrl": "https://yastream.tamthai.de/manifest.json",
    "description": "Yet Another Stream. Stream asian dramas, series and movies directly with multiple providers. Support catalogs with country selection. Powered by TMDB and TVDB for metadata",
    "logo": "https://yastream.tamthai.de/img/yas.png",
    "category": "Streams"
  },
  {
    "id": "stremionet-youtubio-elfhosted",
    "slug": "youtubio-elfhosted",
    "name": "YouTubio",
    "manifestUrl": "https://youtubio.elfhosted.com/%7B%7D/manifest.json",
    "description": "Watch YouTube videos, subscriptions, watch later, and history in Stremio.",
    "logo": "https://github.com/xXCrash2BomberXx/YouTubio/blob/v0.14.7/icon.png?raw=true",
    "category": "Streams"
  },
  {
    "id": "stremionet-ytztvio",
    "slug": "ytztvio",
    "name": "Ytztvio",
    "manifestUrl": "https://ytztvio.galacticcapsule.workers.dev/manifest.json",
    "description": "Stremio Wrapper for YTS and EZTV Torrents",
    "logo": "https://yts.lt/assets/images/website/logo-YTS.svg",
    "category": "Streams"
  },
  {
    "id": "stremionet-yukistreams",
    "slug": "yukistreams",
    "name": "Yukistreams",
    "manifestUrl": "https://stremio.yukistreams.xyz/manifest.json",
    "description": "Asian streaming gateway for Stremio — anime and Asian drama (Korean / Japanese / Chinese / Hong Kong primary, with Thai / Filipino sources alongside), plus international movies and series. Anime catalogs include genre/ye",
    "logo": "https://stremio.yukistreams.xyz/assets/yukistreams-thumbnail.png",
    "category": "Anime"
  }
];
