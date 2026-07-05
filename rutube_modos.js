(function() {
    'use strict';

    if (!window.Lampa) {
        console.error('Lampa не найдена');
        return;
    }

    // Конфигурация плагина
    const config = {
        name: 'Rutube Search',
        version: '1.0.1',
        description: 'Поиск видео на Rutube'
    };

    // Публичный CORS-прокси (с правильным форматом)
    const CORS_PROXY = 'https://corsproxy.io/?url=';

    // Функция поиска видео на Rutube
    function searchRutube(query, callback) {
        const searchUrl = `https://rutube.ru/api/search/video/?query=${encodeURIComponent(query)}&page=1`;
        const url = CORS_PROXY + encodeURIComponent(searchUrl);
        
        $.ajax({
            url: url,
            dataType: 'json',
            timeout: 10000,
            success: function(data) {
                if (data && data.results && data.results.length > 0) {
                    const videos = data.results.map(video => ({
                        title: video.title,
                        id: video.id,
                        duration: video.duration,
                        thumbnail: video.thumbnail_url || video.image
                    }));
                    callback(videos);
                } else {
                    callback([]);
                }
            },
            error: function() {
                console.error('Ошибка поиска Rutube');
                callback([]);
            }
        });
    }

    // Функция получения прямой ссылки на видеопоток
    function getVideoStream(videoId, callback) {
        const apiUrl = `https://rutube.ru/api/play/options/${videoId}/?format=json`;
        const url = CORS_PROXY + encodeURIComponent(apiUrl);
        
        $.ajax({
            url: url,
            dataType: 'json',
            timeout: 10000,
            success: function(data) {
                // Rutube возвращает JSON с информацией о видео
                // Ищем поле с прямой ссылкой на m3u8 или mp4
                let streamUrl = null;
                
                if (data.video_balancer) {
                    streamUrl = data.video_balancer;
                } else if (data.m3u8) {
                    streamUrl = data.m3u8;
                } else if (data.sources && data.sources.length > 0) {
                    // Иногда ссылки в массиве sources
                    streamUrl = data.sources[0].url;
                }
                
                if (streamUrl) {
                    callback(streamUrl);
                } else {
                    console.error('Не удалось найти ссылку на видеопоток');
                    callback(null);
                }
            },
            error: function() {
                console.error('Ошибка получения видеопотока');
                callback(null);
            }
        });
    }

    // Инициализация плагина
    function init() {
        console.log('Rutube плагин загружен');

        // Слушаем событие открытия карточки фильма
        Lampa.Listener.follow('full', function(e) {
            if (e.type !== 'complite') return;
            
            const movie = e.object.movie;
            if (!movie) return;

            const title = movie.title || movie.original_title || movie.name;
            if (!title) return;

            // Добавляем кнопку "Rutube"
            const btn = $(`
                <div class="full-start__button selector view--online">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                    </svg>
                    <span>Rutube</span>
                </div>
            `);

            btn.on('hover:enter', function() {
                Lampa.Loading.start();

                searchRutube(title, function(videos) {
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
        Lampa.Component.register('rutube_list', function(params) {
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

                item.on('hover:enter', function() {
                    Lampa.Loading.start();
                    
                    // Получаем прямую ссылку на видеопоток
                    getVideoStream(v.id, function(streamUrl) {
                        Lampa.Loading.stop();
                        
                        if (!streamUrl) {
                            Lampa.Noty.show('Не удалось получить ссылку на видео');
                            return;
                        }

                        // Запускаем плеер с прямой ссылкой на поток
                        Lampa.Player.play({
                            url: streamUrl,
                            title: v.title,
                            timeline: Lampa.Timeline.view(Lampa.Utils.hash(v.id))
                        });
                    });
                });

                container.append(item);
            });

            return {
                render: function() { return container; },
                start: function() {
                    Lampa.Controller.add('content', {
                        toggle: function() {
                            Lampa.Controller.collectionSet(container);
                            Lampa.Controller.collectionFocus(container.find('.selector')[0], container);
                        },
                        up: function() { Navigator.move('up'); },
                        down: function() { Navigator.move('down'); },
                        left: function() { Navigator.move('left'); },
                        right: function() { Navigator.move('right'); },
                        back: function() {
                            Lampa.Activity.back();
                        }
                    });
                    Lampa.Controller.toggle('content');
                },
                destroy: function() { container.remove(); }
            };
        });
    }

    // Ждём готовности приложения
    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type == 'ready') init();
        });
    }

})();