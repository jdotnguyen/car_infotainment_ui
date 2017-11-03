/* Universal variables */
var notifications = 0;

/* Document Ready */
$(document).ready(function() {
	/* Show home page */
	$('.home-page').fadeIn();

	/* Add click handlers */
	activateClock();
	addHomePageClickHandlers();
	addEntertainmentPageClickHandlers();
	addNavigationPageClickHandlers();
	addNotificationPageClickHandlers();
	addSettingsPageClickHandlers();
	updateNotifications();
});

/* Activate live clock */
activateClock = function () {
	var today = new Date();
	var h = today.getHours();
	var m = today.getMinutes();
	m = checkTime(m);

	$('.info-time').html(h + ":" + m);

	var t = setTimeout(activateClock, 500);
};

/* Subfunction of activate */
checkTime = function (i) {
	if (i < 10) {
		i = "0" + i
	};
	return i;
};

/* Home page handlers */
addHomePageClickHandlers = function () {
	/* Home page card click handlers */
	$('.card-ui').click(function () {
		var id = $(this)[0].id;

		/* Hide home page */
		$('.home-page').hide();

		/* Show proper page */
		switch(id) {
			case "card-ui-entertainment":
				$('.entertainment-page').fadeIn();
				break;
			case "card-ui-navigation":
				$('.navigation-page').fadeIn();
				break;
			case "card-ui-notifications":
				$('.notifications-page').fadeIn();
				break;
			case "card-ui-settings":
				$('.settings-page').fadeIn();
				break;
		}
	});

	/* Home button click handler */
	$('#home-btn').click(function () {
		/* Check if we're already at home */
		if ($('.home-page').is(':visible')) {
			return false;
		}

		/* Hide all pages */
		$('.app-page').hide();

		/* Show home page */
		$('.home-page').fadeIn();
	});
};

/* Entertainment page handlers */
addEntertainmentPageClickHandlers = function () {
	/* Source button handlers */
	$('.source-btn-body').click(function () {
		var id = $(this)[0].id;

		/* Clear active state from all buttons */
		$('.source-btn-body').removeClass('active');

		/* Style each section accordingly */
		switch(id) {
			case "source-btn-radio":
			case "source-btn-satellite":
				/* Add active class to button */
				$('#' + id).addClass('active');

				/* Show/hide radio header */
				$('.song-info-span-header-radio').fadeIn();

				/* Show/hide play controls */
				$('.play-controls-row').hide();

				/* Reset play controls buttons */
				$('.play-controls-btn').removeClass('active');
				$('#play-controls-play').addClass('active');
				break;
			case "source-btn-usb":
			case "source-btn-bluetooth":
				/* Add active class to button */
				$('#' + id).addClass('active');

				/* Show/hide radio header */
				$('.song-info-span-header-radio').hide();

				/* Show/hide play controls */
				$('.play-controls-row').fadeIn();
				break;
		}
	});

	/* Play control button handlers */
	$('.play-controls-btn').click(function () {
		var id = $(this)[0].id;

		/* Clear active state from all buttons */
		$('.play-controls-btn').removeClass('active');

		/* Style each section accordingly */
		$('#' + id).addClass('active');
	});
};

/* Vehicle Status page handlers */
addNavigationPageClickHandlers = function () {

};

/* Notification page handlers */
addNotificationPageClickHandlers = function () {
	/* Clear notification button */
	$('.notification-clear-btn').click(function() {
		$(this).parent().remove();
		updateNotifications();
	});
};

/* Settings page handlers */
addSettingsPageClickHandlers = function () {

};

/* Update notifications */
updateNotifications = function () {
	/* Notification count */
	notifications = $('.notification-list-item').length;
	$('.notification-badge').html(notifications);

	/* Hide the badge if there's 0 notifications */
	if (notifications == 0) {
		$('.notification-badge').hide();
		$('.notification-list-item-empty').fadeIn();
	} else {
		$('.notification-badge').show();
		$('.notification-list-item-empty').hide();
	}
};