//Gets the message author via the bubble elment.
//TODO: (Needs to be rewritten to use JQuery instead)
//////////////////////////////////////////////////////////
function getMessageAuthor(element) {
	var messageAuthor = "Bot";
	var authorElement = findTagInChildren(element, "SWX-NAME");
	if ( !authorElement ) {
		authorElement = findTagInChildren(element, "A");
		if ( authorElement )
			authorElement = findTagInChildren(authorElement, "SWX-NAME");
	}
	if ( authorElement ) {
		var theSpan = findTagInChildren(authorElement, "SPAN");
		theSpan = findTagInChildren(theSpan, "SPAN");
		var headerElement = findTagInChildren(theSpan, "H4");
		if ( headerElement )
			messageAuthor = headerElement.innerHTML;
	}
	return messageAuthor;
};

//Gets the message timestamp via the bubble elment.
//A bit of hackery with setting the time, can't seem to get a precise time.
//TODO: (Needs to be rewritten to use JQuery instead)
//////////////////////////////////////////////////////////
function getMessageTime(element) {
	var messageTime = "0";
	var stampElement = findClassInChildren(element, "timestamp offScreen");
	if (!stampElement) {
		stampElement = findClassInChildren(element, "timestamp");
	}
	if ( stampElement ) {
		var pTimeElement = findTagInChildren(stampElement, "P");
		var innerHTML = pTimeElement.innerHTML;
		var timeRegex = /[0-9]{1,2}:[0-9]{1,2} (am|pm)/g;
		var dateRegex = /[0-9]{1,2}\/[0-9]{1,2}/g;
		if ( timeRegex.test(innerHTML) ) {
			var splitTime = innerHTML.split(":");
			splitTime[1] = splitTime[1].replace(" am", "");
			splitTime[1] = splitTime[1].replace(" pm", "");
			var dateObj = new Date();
			if(innerHTML.indexOf("am") != -1) {
				var hours = parseInt(splitTime[0]);
				var minutes = parseInt(splitTime[1]);
				dateObj.setHours(hours);
				dateObj.setMinutes(minutes);
			}
			else {
				var hours = 12 + parseInt(splitTime[0]);
				var minutes = parseInt(splitTime[1]);
				dateObj.setHours(hours);
				dateObj.setMinutes(minutes);
			}
			messageTime = dateObj.getTime();
		}
		else if ( dateRegex.test(innerHTML) ) {
			messageTime = Date.parse(innerHTML + "/15");
		}
		else {
			var dateObj = new Date();
			var newDate = parseInt(dateObj.getDate()) - 1;
			if ( newDate == 0 )
				newDate = 31;
			dateObj.setDate(newDate);
			messageTime = dateObj.getTime();
		}
	}
	return messageTime.toString();
};

//Gets the message text via bubble element.
//TODO: (Needs to be rewritten to use JQuery instead)
//////////////////////////////////////////////////////////
function getMessageText(element) {
	var messageText = "";
	var contentElement = findClassInChildren(element, "content");
	if ( contentElement ) {
		var pMessageElement = findTagInChildren( contentElement, "P" );
		if ( pMessageElement )
			var messageText = pMessageElement.innerHTML;
		var aLinkElement = findTagInChildren(pMessageElement, "A");
			if (aLinkElement)
				messageText = aLinkElement.innerHTML;
	}
	return messageText;
};

//Gets the message ID via bubble element.
//TODO: (Needs to be rewritten to use JQuery instead)
//////////////////////////////////////////////////////////
function getMessageID(element) {
	var messageID = "";
	var contentElement = findClassInChildren(element, "content");
	if ( contentElement )
		messageID = contentElement.id;
	messageID = messageID.replace("msg_", "");
	return messageID;
};

//Attempts to cache the chat messages so it doesn't examine them again.
//Needs some work.
//////////////////////////////////////////////////////////
function chatMessageSaved(element) {
	return ( chatMessages.hasOwnProperty(getMessageID(element)) );
};

//UNUSED/TODO
//////////////////////////////////////////////////////////
function chatMessageUnread(element) {
	return ( sessionStorage.getItem(getMessageID(element)) == null );
};

//Adds the information for the chat message into the chatMessages array, and returns it.
//////////////////////////////////////////////////////////
function addChatMessage(bubbleElement) {
	var contentElement = findClassInChildren(bubbleElement, "content");
	if (contentElement) {
		var theMessage = {
			id: getMessageID(bubbleElement),
			text: getMessageText(bubbleElement),
			time: getMessageTime(bubbleElement),
			author: getMessageAuthor(bubbleElement),
			convoName: currentConversation
		}
		chatMessages[theMessage.id] = theMessage;
		return theMessage;
	}
};

//When a new message has been examined, commands in this case.
//Attempts to check for a command.
//The message is also passed to the command, just in-case it's needed.
//////////////////////////////////////////////////////////
function onNewMessage(theMessage) {
	if ( theMessage.text.indexOf(getConfigValue("command-prefix") ) == 0 ) {
		if ( theMessage.text == getConfigValue("command-prefix") ) 
			return;
		var skypeUsername = getSkypeUsername(theMessage.author);
		if ( bannedUsers.hasOwnProperty(skypeUsername) )
			return;
		var theCommand = theMessage.text.replace(getConfigValue("command-prefix") + " ", "");
		var cmdName = /^\S*/.exec(theCommand);
		var cmdArgs = theCommand.replace(cmdName + " ", "");
		if ( commandHandles.hasOwnProperty(cmdName) ) {
			var hasOperatorFlag = commandHandles[cmdName].hasOwnProperty("operator-only");
			if ( hasOperatorFlag && commandHandles[cmdName]["operator-only"] ) {
				if ( !isOperator( theMessage.author ) ) {
					sendChat("You must be operator to use this command.");
					return;
				}
			}
			commandHandles[cmdName]["function"](cmdArgs, theMessage);
		}
	}
};

//The chat messages loop.
//Should ignore messages when first loaded, and then processes new messages.
//It also should ignore commands from conversations that aren't the main-conversation.
//The time check is a back-up for ignoring old messages.
//Also attempts to cache the skype username.
//(11/07/2015) - Constantly scrolls to bottom of the chat now.
//Checks if the conversation name has changed, and updates the main-conversation.
//////////////////////////////////////////////////////////
function checkMessages() {
	var convoElement = $("div.conversation.scrollable.scrollViewport");
  	convoElement.scrollTop(convoElement[0].scrollHeight);
  	var lastConvoNameChange = $("swx-message.message.showName.their.participant.swx-in-viewport").last();
	if (lastConvoNameChange) {
		var theBubble = $(lastConvoNameChange).find("div.bubble");
		if (theBubble && theBubble[0]) {
			var id = getMessageID(theBubble[0]);
			var text = getMessageText(theBubble[0]);
			if(!convoNameChanges.hasOwnProperty(id)) {
				convoNameChanges[id] = text;
				if(!conversationExists(getConfigValue("main-conversation")))
				{
					var convoNameRegex = /'(.*)'?/gi;
					var matchArray = text.match(convoNameRegex);
					if(matchArray && matchArray.length > 0)
					{
						var newConvoName = matchArray[0].substring(1, matchArray[0].length);
						newConvoName = newConvoName.substring(0, newConvoName.length-1);
						setConfigValue("main-conversation", newConvoName);
						addConsoleText(coloredSpan("#F5A9A9", "The Main Conversation name was changed, ") + coloredSpan("#BCF5A9", "setting it to [ " + coloredSpan("#CEF6F5", getConfigValue("main-conversation" )) + " ]"));
					}
				}
			}
		}
	};
	$("swx-message.message.their:not(.me)").each(function(){
		var theBubble = $(this).find("div.bubble");
		if ( !theBubble || !theBubble[0] )
			return;
		theBubble = theBubble[0];
		var avatarBubble = $(this).find("a");
		var avatarImage = avatarBubble.find("img");
		var urlText = avatarImage.attr("src");
		if ( urlText ) {
			urlText = urlText.replace("https://api.skype.com/users/", "");
			var urlArray = urlText.split("/");
			urlText = urlArray[0];
			var nickName = getMessageAuthor(theBubble);
			usernameCache[urlText] = nickName;
		}
		if ( !chatMessageSaved(theBubble) ) {
			//Removes the thumbnails that sometimes show up when putting links in chat.
			var thumbnail = $(this).find("div.bubble").find("div.content").find("div");
			if (thumbnail)
				thumbnail.remove();

			var theMessage = addChatMessage(theBubble);
			var currentSeconds = new Date().getTime() / 1000;
			if ( !firstRead && theMessage && theMessage.author != "Bot" ) {
				var messageSeconds = ( parseInt( theMessage.time ) ) / 1000;
				var secondsSince = currentSeconds - messageSeconds;
				if ( secondsSince < 60 ) {
					var shouldSkip = false;
					if ( ( getConfigValue("main-conversation") != "" ) && theMessage.convoName != getConfigValue("main-conversation") )
						shouldSkip = true;

					if ( !shouldSkip && !getConfigValue("ignore-input") ) {
						onNewMessage(theMessage);
					}
				}
			}
		}
    });
    firstRead = false;
};