/* Document Ready */
$(document).ready(function() {
	/* Show home page */
	$('.home-page').fadeIn();

	/* Add click handlers */
	addHomePageClickHandlers();
	addEntertainmentPageClickHandlers();
	addCommunicationPageClickHandlers();
	addNotificationPageClickHandlers();
	addSettingsPageClickHandlers();
});

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
			case "card-ui-communication":
				$('.communication-page').fadeIn();
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
		switch(id) {
			case "play-controls-previous":
				/* Add active class to button */
				$('#' + id).addClass('active');
				break;
			case "play-controls-backward":
				/* Add active class to button */
				$('#' + id).addClass('active');
				break;
			case "play-controls-play":
				/* Add active class to button */
				$('#' + id).addClass('active');
				break;
			case "play-controls-forward":
				/* Add active class to button */
				$('#' + id).addClass('active');
				break;
			case "play-controls-next":
				/* Add active class to button */
				$('#' + id).addClass('active');
				break;
			case "play-controls-stop":
				/* Add active class to button */
				$('#' + id).addClass('active');
				break;
		}
	});
};

/* Communication page handlers */
addCommunicationPageClickHandlers = function () {

};

/* Notification page handlers */
addNotificationPageClickHandlers = function () {

};

/* Settings page handlers */
addSettingsPageClickHandlers = function () {

};