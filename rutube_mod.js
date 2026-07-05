(function () {
    'use strict';

    if (!window.Lampa) return;

    // Публичный CORS-прокси (без него Rutube блокирует запросы из браузера)
    const CORS_PROXY = 'https://corsproxy.io/?';

    // Поиск видео на Rutube
    function searchRutube(query, callback) {
        const url = CORS_PROXY + encodeURIComponent(
            `https://rutube.ru/api/search/video/?query=${encodeURIComponent(query)}&page=1`
        );

        $.ajax({
            url: url,
            dataType: 'json',
            timeout: 10000,
            success: function (data) {
                if (data && data.results && data.results.length) {
                    callback(data.results.map(v => ({
                        title: v.title,
                        id: v.id,
                        duration: v.duration,
                        thumbnail: v.thumbnail_url || v.image
                    })));
                } else {
                    callback([]);
                }
            },
            error: function () {
                callback([]);
            }
        });
    }

    // Ждём загрузки Lampa
    Lampa.Listener.follow('app_ready', function () {

        // Добавляем кнопку "Rutube" в карточку фильма
        Lampa.Listener.follow('full_start', function (e) {
            const movie = e.object.movie;
            if (!movie) return;

            const title = movie.title || movie.original_title || movie.name;
            if (!title) return;

            const btn = $(`
                <div class="full-start__button selector view--online">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                    </svg>
                    <span>Rutube</span>
                </div>
            `);

            btn.on('hover:enter', function () {
                Lampa.Loading.start();

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
        Lampa.Component.register('rutube_list', function (params) {
            const container = $('<div class="category-full"></div>');

            params.videos.forEach(v => {
                const item = $(`
                    <div class="selector online">
                        <div class="online__body">
                            <div class="online__title">${v.title}</div>
                            <div class="online__quality">Rutube</div>
                        </div>
                    </div>
                `);

                item.on('hover:enter', function () {
                    // Запускаем плеер с embed-ссылкой Rutube
                    Lampa.Player.play({
                        url: `https://rutube.ru/play/embed/${v.id}`,
                        title: v.title,
                        timeline: Lampa.Timeline.view(Lampa.Utils.hash(v.id))
                    });
                });

                container.append(item);
            });

            return {
                render: function () { return container; },
                start: function () {
                    Lampa.Controller.add('content', {
                        toggle: function () {
                            Lampa.Controller.collectionSet(container);
                            Lampa.Controller.collectionFocus(container.find('.selector')[0], container);
                        },
                        up: function () { Navigator.move('up'); },
                        down: function () { Navigator.move('down'); },
                        left: function () { Navigator.move('left'); },
                        right: function () { Navigator.move('right'); },
                        back: function () {
                            Lampa.Activity.back();
                        }
                    });
                    Lampa.Controller.toggle('content');
                },
                destroy: function () { container.remove(); }
            };
        });
    });
})();