function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

var url = new URL(location.href);
//console.log(url);
var i = url.searchParams.get("i");
var cookie_name = 'btfr_captcha_edit:' + i;
var goal_id = getCookie(cookie_name);
//console.log(i);

var selectorName = 'btfr_captcha_selector:' + i;
var selector = getCookie(selectorName);

if(!window.isTop && goal_id){
	//console.log('groupId = ' + i);
	//console.log('goal_id = ' + goal_id);
	//console.log('selector = ' + selector);

		window.parent.postMessage(
    		{
        		event_id: 'btfr_captcha_edit',
        		data: {
            			gid: i,
            			goal: goal_id,
				selector: selector
        		}
    		},
    		"*"
		);

}

var code = 'btfr_code_checking:' + i;
var value = getCookie(code);
//console.log('i = ' + i);

if(!window.isTop && value == '1'){
	//console.log('btfr_code_checking = ' + value);

		//console.log('send')
		window.parent.postMessage(
			{
				event_id: 'btfr_code_checking',
				data: {
				gid: i,
						value: 1
				}
			},
			"*"
		);
}
