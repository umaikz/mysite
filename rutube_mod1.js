(function () {
    'use strict';

    if (!window.Lampa) return;

    // Публичный CORS-прокси (без него Rutube блокирует запросы из браузера)
    var CORS_PROXY = 'https://corsproxy.io/?url=';

    function proxied(url) {
        return CORS_PROXY + encodeURIComponent(url);
    }

    // Поиск видео на Rutube
    function searchRutube(query, callback) {
        var url = proxied('https://rutube.ru/api/search/video/?query=' + encodeURIComponent(query) + '&page=1');

        $.ajax({
            url: url,
            dataType: 'json',
            timeout: 10000,
            success: function (data) {
                if (data && data.results && data.results.length) {
                    callback(data.results.map(function (v) {
                        return {
                            title: v.title,
                            id: v.id,
                            duration: v.duration,
                            thumbnail: v.thumbnail_url || v.image
                        };
                    }));
                } else {
                    callback([]);
                }
            },
            error: function () {
                callback([]);
            }
        });
    }

    // Получение реальной ссылки на видеопоток (m3u8) через play/options
    function getStreamUrl(videoId, callback, onError) {
        var url = proxied('https://rutube.ru/api/play/options/' + videoId + '/?format=json&no_404=true&referer=https%3A%2F%2Frutube.ru');

        $.ajax({
            url: url,
            dataType: 'json',
            timeout: 10000,
            success: function (data) {
                var stream = '';

                // video_balancer обычно содержит m3u8/default ссылку
                if (data && data.video_balancer) {
                    stream = data.video_balancer.m3u8 || data.video_balancer.default || '';
                }

                // fallback: иногда ссылка лежит в других полях в зависимости от версии API
                if (!stream && data && data.balancer) {
                    stream = data.balancer.m3u8 || data.balancer.default || '';
                }

                if (stream) {
                    callback(stream);
                } else if (onError) {
                    onError();
                }
            },
            error: function () {
                if (onError) onError();
            }
        });
    }

    function init() {

        // Добавляем кнопку "Rutube" в карточку фильма
        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite') return;

            var movie = e.data.movie;
            if (!movie) return;

            var title = movie.title || movie.original_title || movie.name;
            if (!title) return;

            var btn = $(
                '<div class="full-start__button selector view--rutube">' +
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">' +
                        '<path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>' +
                    '</svg>' +
                    '<span>Rutube</span>' +
                '</div>'
            );

            btn.on('hover:enter', function () {
                Lampa.Loading.start(function () {
                    Lampa.Loading.stop();
                });

                searchRutube(title, function (videos) {
                    Lampa.Loading.stop();

                    if (!videos.length) {
                        Lampa.Noty.show('Видео не найдено на Rutube');
                        return;
                    }

                    // Открываем список найденных видео
                    Lampa.Activity.push({
                        url: '',
                        title: 'Rutube: ' + title,
                        component: 'rutube_list',
                        movie: movie,
                        videos: videos
                    });
                });
            });

            e.object.activity.render().find('.full-start__buttons').append(btn);
        });

        // Регистрируем компонент для отображения списка видео
        Lampa.Component.add('rutube_list', function (object) {
            var scroll = new Lampa.Scroll({ mask: true, over: true });
            var container = $('<div class="category-full"></div>');
            var html = $('<div></div>');

            object.videos.forEach(function (v) {
                var item = Lampa.Template.js(
                    '<div class="selector online">' +
                        '<div class="online__body">' +
                            '<div class="online__title">{title}</div>' +
                            '<div class="online__quality">Rutube</div>' +
                        '</div>' +
                    '</div>',
                    { title: v.title }
                );

                item.on('hover:enter', function () {
                    Lampa.Loading.start();

                    getStreamUrl(v.id, function (streamUrl) {
                        Lampa.Loading.stop();

                        Lampa.Player.play({
                            url: streamUrl,
                            title: v.title,
                            timeline: Lampa.Timeline.view(Lampa.Utils.hash('rutube_' + v.id))
                        });

                        Lampa.Player.playlist([{
                            url: streamUrl,
                            title: v.title
                        }]);
                    }, function () {
                        Lampa.Loading.stop();
                        Lampa.Noty.show('Не удалось получить ссылку на видео');
                    });
                });

                html.append(item);
            });

            container.append(html);
            scroll.body().append(container);
            scroll.minus(scroll.render().find('.scroll__body'));

            this.create = function () {};

            this.render = function () {
                return scroll.render();
            };

            this.start = function () {
                Lampa.Controller.add('content', {
                    toggle: function () {
                        Lampa.Controller.collectionSet(container);
                        Lampa.Controller.collectionFocus(container.find('.selector')[0], container);
                    },
                    up: function () { Navigator.move('up'); },
                    down: function () { Navigator.move('down'); },
                    left: function () {
                        Navigator.canmove('left') ? Navigator.move('left') : Lampa.Controller.toggle('menu');
                    },
                    right: function () { Navigator.move('right'); },
                    back: function () { Lampa.Activity.backward(); }
                });
                Lampa.Controller.toggle('content');
            };

            this.pause = function () {};
            this.stop = function () {};

            this.destroy = function () {
                scroll.destroy();
                container.remove();
            };
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
