(function () {
    'use strict';

    function init() {
        if (window.rutube_mod) return;
        window.rutube_mod = true;

        var http = new Lampa.Reguest();
        var API = 'https://rutube.ru/api';

        function RutubeSource() {
            var self = this;

            self.search = function (q, ok, err) {
                var url = API + '/search/video/?query=' + encodeURIComponent(q) + '&format=json&limit=30';
                http.silent(url, function (json) {
                    var items = (json.results || []).map(function (v) {
                        return {
                            id: v.id,
                            title: v.title || '',
                            poster: v.thumbnail_url || '',
                            url: 'rutube:' + v.id,
                            source: 'RUTUBE'
                        };
                    });
                    ok({ results: items });
                }, err || function () { ok({ results: [] }); });
            };

            self.full = function (params, ok, err) {
                var card = params.card || params;
                if (card.url && card.url.indexOf('rutube:') === 0) {
                    ok(card);
                } else {
                    ok(params);
                }
            };
        }

        Lampa.Api.sources.rutube = new RutubeSource();
        Object.defineProperty(Lampa.Api.sources, 'RUTUBE', {
            get: function () { return Lampa.Api.sources.rutube; }
        });

        Lampa.Listener.follow('player', function (e) {
            if (e.type === 'play' && e.data && typeof e.data.url === 'string' && e.data.url.indexOf('rutube:') === 0) {
                var id = e.data.url.replace('rutube:', '');
                e.data.url = '';
                http.silent(API + '/play/options/' + id + '/?format=json', function (opt) {
                    var streamUrl = opt.hls || opt.video_url || opt.dash || opt.playback_url;
                    if (streamUrl) {
                        Lampa.Player.open({ url: streamUrl, title: e.data.title });
                    }
                });
            }
        });
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }
})();
