var federationUrlBase = "https://signin.aws.amazon.com/federation";
var awsConsole = 'https://console.aws.amazon.com/';
var logoutUrl = awsConsole + 'console/logout!doLogout';

var createNotification = function(message) {
  chrome.notifications.create({
    type: "basic",
    title: 'Holochrome',
    message: message,
    iconUrl: 'holochrome-128.png'
  });
};

var request = function(url, callback, isEvent, attempts=0) {

  if (attempts > 2) {
    console.log("Too many attempts. Retrying from beginning.");
    getMyCreds(isEvent);
    return;
  }

  console.log('Making HTTP request to: ' + url);
  fetch(url)
    .then(
      function(response) {
        switch (response.status) {
          case 200:
            callback(response);
            break;
          case 400:
            // follow logout redirect, then re-administer login command
            request(logoutUrl,  function(){
              request(url, callback, isEvent, attempts++);
            }, false, attempts++);
            break;
          case 0:
            var errorMessage = "The instance metadata service could not be reached.";
            console.log(errorMessage);
            if (isEvent) {
              createNotification(errorMessage);
            }
            break;
          case 500:
            var errorMessage = "Cannot find IAM role. Are you on a machine with an instance profile?";
            console.log(errorMessage);
            if (isEvent) {
              createNotification(errorMessage);
            }
            break;
          default:
            break;
        }
      })
    .catch(function(err) {
      var errorMessage = "Cannot find IAM role. Are you on a machine with an instance profile?";
      console.log(errorMessage);
      if (isEvent) {
        createNotification(errorMessage);
      }
    });
};

var getSigninToken = function(creds, isEvent) {
  var signinTokenUrl = federationUrlBase
                        + '?Action=getSigninToken'
                        + '&SessionDuration=43200'
                        + '&Session=' + encodeURIComponent(JSON.stringify(creds));
  var onComplete = function(response) {
      response.json().then(function(json) {
        getSessionCookies(json['SigninToken'], isEvent);
      });
  };
  request(signinTokenUrl, onComplete, isEvent);
};

var getSessionCookies = function(signinToken, isEvent) {
  var federationUrl = federationUrlBase
                        + '?Action=login'
                        + '&Issuer=holochrome'
                        + '&Destination=' + encodeURIComponent(awsConsole)
                        + '&SigninToken=' + signinToken;
  var onComplete = function(response) {
    openTabWithConsole(isEvent);
  };
  request(federationUrl, onComplete, isEvent);
};

var getMyCreds = function(isEvent){
  var metadataUrl = "http://169.254.169.254/latest/meta-data/iam/security-credentials/";
  var onComplete = function(response) {
      response.text().then(function(profileName) {
        getMyCredsFromProfile(isEvent, profileName);
      });
  };
  request(metadataUrl, onComplete, isEvent);
}

var getMyCredsFromProfile = function(isEvent, profileName){
  var metadataUrl = "http://169.254.169.254/latest/meta-data/iam/security-credentials/" + profileName;
  var onComplete = function(response) {
      response.json().then(function(json) {
        var myCreds = {
          'sessionId': json["AccessKeyId"],
          'sessionKey': json["SecretAccessKey"],
          'sessionToken': json["Token"]
        };
        getSigninToken(myCreds, isEvent);
     });
  };
  request(metadataUrl, onComplete, isEvent);
}

var openTabWithConsole = function(isEvent){
  if(isEvent) {
    chrome.windows.getLastFocused(function(window){
      chrome.windows.update(window.id,
      {
        focused: true
      });
      chrome.tabs.create(
        {
          windowId: window.id,
          url: awsConsole,
          active: true
        });
    });
  }
}

var eventTriggered = function(arg) {
  console.log("Event received.");
  getMyCreds(true);
};

chrome.commands.onCommand.addListener(eventTriggered);

chrome.action.onClicked.addListener(eventTriggered);

var init = (function(){
  getMyCreds(false);
  // TODO: Make the refresh period a user input
  // 10 hour timeout (10 hours * 60 minutes * 60 seconds * 1000 ms)
  const timeoutMilliseconds = 10 * 60 * 60 * 1000;
  setInterval(getMyCreds, timeoutMilliseconds, false);
})();


