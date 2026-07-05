(function()  {
    'use strict';

    // Проверяем, что Lampa загружена
    if (!window.Lampa) {
        console.error('Lampa не найдена');
        return;
    }

    // Конфигурация плагина
    const config = {
        name: 'Rutube Search',
        version: '1.0.0',
        description: 'Поиск видео на Rutube'
    };

    // Функция поиска видео на Rutube
    function searchRutube(query, callback) {
        // Rutube не имеет публичного API, поэтому используем их поиск
        const searchUrl = `https://rutube.ru/api/search/video/?query=${encodeURIComponent(query)}&page=1`;
        
        // Делаем запрос
        $.ajax({
            url: searchUrl,
            dataType: 'json',
            success: function(data) {
                if (data && data.results && data.results.length > 0) {
                    const videos = data.results.map(video => ({
                        title: video.title,
                        url: `https://rutube.ru/video/${video.id}/`,
                        embed: `https://rutube.ru/play/embed/${video.id}`,
                        duration: video.duration,
                        thumbnail: video.thumbnail_url
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

    // Создаем компонент для отображения результатов
    function createRutubeComponent(movie) {
        const component = new Lampa.Component();
        
        // Получаем название фильма
        const title = movie.movie.title || movie.movie.original_title;
        
        // Ищем видео
        searchRutube(title, function(videos) {
            if (videos.length === 0) {
                component.empty('Видео не найдено на Rutube');
                return;
            }

            // Отображаем результаты
            videos.forEach(video => {
                const item = Lampa.Template.get('online_mod', {
                    title: video.title,
                    quality: 'HD',
                    info: ''
                });

                item.on('hover:enter', function() {
                    // Запускаем плеер с embed ссылкой
                    Lampa.Player.play({
                        url: video.embed,
                        title: video.title,
                        timeline: Lampa.Timeline.view(Lampa.Utils.hash(title))
                    });
                });

                component.append(item);
            });

            component.start(true);
        });

        return component;
    }

    // Регистрируем плагин в Lampa
    Lampa.Listener.follow('app_ready', function() {
        // Добавляем кнопку в карточку фильма
        Lampa.Template.add('rutube_button', `
            <div class="full-start__button selector view--rutube">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
                <span>Rutube</span>
            </div>
        `);

        // Добавляем обработчик для кнопки
        Lampa.Card.add('rutube', function(card) {
            const button = $(Lampa.Template.get('rutube_button', {}));
            
            button.on('hover:enter', function() {
                // Открываем компонент с результатами поиска
                Lampa.Activity.push({
                    url: '',
                    title: 'Rutube: ' + (card.movie.title || card.movie.original_title),
                    component: 'rutube_search',
                    movie: card.movie,
                    page: 1
                });
            });

            card.activity.render().find('.full-start__buttons').append(button);
        });

        // Регистрируем компонент для отображения результатов
        Lampa.Component.register('rutube_search', createRutubeComponent);

        console.log('Rutube плагин загружен');
    });

    // Добавляем переводы
    Lampa.Lang.add({
        'rutube_search': {
            ru: 'Поиск на Rutube',
            en: 'Search on Rutube',
            uk: 'Пошук на Rutube'
        }
    });

})();
