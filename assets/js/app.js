/* Document Ready */
$(document).ready(function() {
	/* Add click handlers */
	addClickHandlers();
});

/* Click handlers */
addClickHandlers = function () {
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