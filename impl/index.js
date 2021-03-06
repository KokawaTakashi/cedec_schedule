//------------------------------------------------------------------------------
//
//------------------------------------------------------------------------------
(function(){
	//==========================================================================
	// 定義
	//==========================================================================
	var WEEK_DAY_SHORT_STRINGLIST = [ "日", "月", "火", "水", "木", "金", "土" ];
	var MIN_MINUTES	= 5;

	var m_url_params = getURL_Params();
	var m_year		 = 2016;
	if( m_url_params.year !== undefined )	m_year = m_url_params.year;

	var highlightInfo = {
		enabled	: false,
		dayIndex: 0,
		intervalId:-1,
	}
	var m_opendDay = new Date();
	var m_debugHighlighDay = undefined;
//	var m_opendDay	 = new Date(2016,7,24,11,20);
//	var m_debugHighlighDay = m_opendDay;

	var hideInfo	= {};

	var m_setting;
	var m_rootURL;

	$(document).ready(function(){

		m_setting	= CEDEC.findSettingFromYear( m_year );
		m_rootURL	= CEDEC.MASTER_URL + m_year + "/";

		$('body')
			.removeClass('ui-overlay-a')
			.css('overflow-x','visible')
			.find('.ui-page')
			.css('overflow-x','visible');

		appendHeader();
		CEDEC.appendNaviMenuTo( $('#old').next() );

		var dayIndex = 0;

		// 開催機関であれば、選択
		if( m_opendDay.getFullYear() == m_setting.year ){
			var month = parseInt(m_setting.first_date.slice(0,2),10);
			var first_day = parseInt(m_setting.first_date.slice(2,4),10);
			if( m_opendDay.getMonth()+1 == month ){
				for( var i = 0 ; i < CEDEC.TIME_SPAN ; ++i ){
					if( (first_day + i) != m_opendDay.getDate() ) continue;
					dayIndex = i;

					highlightInfo.enabled  = true;
					highlightInfo.dayIndex = dayIndex;
					break;
				}
			}

		}

		setTimeout( dispSessionSchedule, 10, dayIndex );
	});

	//--------------------------------------------------------------------------
	// ヘッダーに追加
	//--------------------------------------------------------------------------
	function appendHeader(){

		var $header = $('#contents_header').empty();

		$header.append('<h1>CEDEC ' + m_year + 'スケジュール</h1>');

		var month = parseInt(m_setting.first_date.slice(0,2),10);
		var first_day = parseInt(m_setting.first_date.slice(2,4),10);
		var date = new Date( m_year, month-1, first_day);

		var $div = $('<div></div>');

		for( var i = 0 ; i < 3 ; ++i ){
			$('<input type="button" class="schedule_button"></input>')
				.val( month + "/" + (first_day+i) + "(" + WEEK_DAY_SHORT_STRINGLIST[date.getDay()+i] +")" )
				.attr( 'data_index', i )
				.click(function(){
					setTimeout( dispSessionSchedule, 10, parseInt( $(this).attr('data_index') ) );
				})
				.appendTo( $div );
		}

		$div.appendTo( $header );

	}

	//--------------------------------------------------------------------------
	//
	//--------------------------------------------------------------------------
	function dispSessionSchedule( index ){

		// ハイライト処理を停止
		if( highlightInfo.intervalId >= 0 ){
			clearInterval( highlightInfo.intervalId );
			highlightInfo.intervalId = -1;
		}

		// loading icon
		$('#contents_body').prepend(
			'<img id="contents_loading_icon" src="./image/rolling.gif" />'
		)
		$('#day_table').parent().remove();

		var rel_path 	= CEDEC.convertFormatPath( m_setting, index );

		CEDEC.readData({
			index : index,
			url	  : m_rootURL + rel_path,
			success	: function(index,data){
				$('#contents_loading_icon').remove();
				appendTable( index,data );
				CEDiL.readData( m_setting.cedil_tag_no, appendLinkToCEDiL );
			},
			error: function(index,data){
				$('#contents_loading_icon').remove();
			   alert('読み込みに失敗');
			}
		});
	}

	//--------------------------------------------------------------------------
	// XMLからテーブルを作成し追加する
	//--------------------------------------------------------------------------
	function appendTable(index, xml){
		var $xml		  = $(xml);
		var $contets_body = $('#contents_body');

		var roomList = createRoomSessionList( $xml );	// 部屋毎のデータを取得

		// テーブル作成
		var $table = createBaseTable( roomList );
		appendSessionListTo( $table, roomList );
		convertGlobalPath( $table );
		hideTr( $table, roomList );
		$contets_body.find("tr:hidden,td:hidden").remove();

		// フィルター作成
		var $filter = createFilter( roomList );
		convertGlobalPath( $filter );
		commitFilterInfoTo( $table );

		// commit
		$("<div></div>")
			.append([
				$filter,
				"<h2>" + $xml.find("h2").html() +"</h2>",
				$table
			])
			.appendTo( $contets_body );

		$contets_body.find("h2 > img").each(function(){
			var $this = $(this);
			var image_path = m_rootURL + "images" + $this.attr("src").split("../images")[1];
			$this.attr("src", image_path );
		});

		customizeTable(index);
		FixedMidashi.create();

		return;

		//----------------------------------------------------------------------
		// 部屋毎のセッションのデータ連想配列データ
		//----------------------------------------------------------------------
		function createRoomSessionList( $xml ){
			var roomList 	= {};	//
			var unique 		= 0;	// 無名ルームがあった場合の簡易カウンター

			$xml.find( CEDEC.SCHEDULE_UNIT_SELECTOR ).each(function(){
				$(this).find("table").each(function(){
					var data  = CEDEC.createSessionData( $(this) );
					findAppendToRoomList( data ).push( data );
				});
			});
			return roomList;

			// スケジュール情報から 追加先リストを返す
			function findAppendToRoomList( data ){
				var room_name = data.getRoomNo();

				if( room_name != "" ){
					if( roomList[room_name] === undefined ){
						roomList[room_name] = [];
					}
					return roomList[room_name];
				}

				// ルーム表記がない場合は、空いてるリストに詰める
				for(var name in roomList){
					var rList = roomList[name];
					var isOverlaped = false;

					for( var l = 0 ; l < rList.length ; ++l ){
						if( rList[l].isOverlap( data ) ){
							isOverlaped = true;
							break;
						}
					}
					if( isOverlaped == false ){
						room_name = name;
						break;
					}
				}

				// 無名なので新しくリストを追加する
				if( room_name == "" ){
					room_name = "不明_" + unique;
					roomList[room_name] = [];
					++unique;
				}
				return roomList[room_name];
			}
		}

		//----------------------------------------------------------------------
		// 分野等の表示フィルター部生成
		//----------------------------------------------------------------------
		function createFilter( roomList ){
			var filterList = {};
			for(var room_name in roomList){
				for( var i = 0 ; i < roomList[room_name].length ; ++i ){
					var rData = roomList[room_name][i];
					var $spec = rData.getMainSpecObject();
					filterList[$spec.attr("alt")] = $spec;
				}
			}

			var $filter = $('<div class="spec_filter"></div>');
			for(var filter_name in filterList){
				$filter.append( filterList[filter_name].clone() );
			}
			$filter.children().click(function(){
				var $this = $(this);
				var alt   = $this.attr('alt');

				if( $this.hasClass('hide') ){
					$this.removeClass('hide');
					hideInfo[alt]=undefined;
					Cookies.remove( m_year + '_hide_' + alt );
				}else{
					$this.addClass('hide');
					hideInfo[alt]=true;
					Cookies.set( m_year + '_hide_' + alt, '1', {expires:365} );
				}

				commitFilterInfoTo( $('#day_table') );

				// crossDomain では動作せず
				//this.src =  grayscale(this.src);
			}).each(function(){
				var $this = $(this);
				var alt   = $this.attr('alt');

				if( Cookies.get( m_year + '_hide_' + alt ) !== undefined ){
					$this.addClass('hide');
					hideInfo[alt]=true;
				}
			});

			return $filter;

		}

		//----------------------------------------------------------------------
		// 指定DOMにフィルター情報を反映
		//----------------------------------------------------------------------
		function commitFilterInfoTo( $table ){

			$table.find('td[spec]').each(function(){
				var $this = $(this);
				var alt	  = $this.attr('spec');

				if( hideInfo[alt] === undefined ){
					$this.children().show();
				}else{
					$this.children().hide();
				}
			})
		}

		//----------------------------------------------------------------------
		// 時間と部屋番号のテーブルを作成
		//----------------------------------------------------------------------
		function createBaseTable( roomList ){
			var $tbody = $("<tbody></tbody>");
			var $thead = $("<thead></thead>");

			var $tr_base = $('<tr><td class="time"></td></tr>');
			var $th = $('<tr><th class="time"></th></tr>');
			for(var room_name in roomList){
				$tr_base.append( '<td room="' + room_name + '"></td>' );
				$th.append( '<th room="' + room_name + '">'+room_name+'</th>' );
			}
			$thead.append( $th );

			var hour 	= 9;
			var minutes = 0;
			var endHour		= 19;
			var endMinutes	= 0;

			for(;;){
				if( (hour*60 + minutes) > (endHour*60 + endMinutes) ){
					break;
				}

				var $tr = $tr_base.clone(true);

				var time_str = (hour.toString().length == 1 ? "0" + hour.toString() : hour.toString()) + ':' +
						  (minutes.toString().length == 1 ? "0" + minutes.toString() : minutes.toString());

				$tr.attr( 'time', time_str )
					.children('.time')
						.text( time_str );

				$tbody.append( $tr );

				minutes += MIN_MINUTES;
				if( minutes >= 60 ){
					minutes = 0;
					hour	+= 1;
				}
			}

			return $('<table id="day_table" _fixedhead="cols:1"></table>').append([
				$thead,
				$tbody
			]);

		}

		//----------------------------------------------------------------------
		// テーブルにイベントを追加
		//----------------------------------------------------------------------
		function appendSessionListTo( $table, roomList ){

			var $thead = $table.children("thead");
			var $tbody = $table.children("tbody");

			for(var room_name in roomList){
				var list = roomList[room_name];

				var $trList = $tbody.find('tr');
				for( var i = 0 ; i < list.length ; ++i ){
					var rData = list[i];
					var $info = rData.info;
					var $infoMain = $info.find("td").children();
					var startTime = rData.getStartTimeString();
					var endTime   = rData.getEndTimeString();

					var $tr = $trList.filter('[time="' + startTime +'"]');
					var $td = $tr.find('[room="'+room_name +'"]');
					var rowSpan = getRowSpan(startTime,endTime);

					$td.attr('rowSpan', rowSpan )
						.attr("spec", rData.getMainSpecObject().attr("alt") )
						.addClass( "session")
						.addClass( "session_color_style_normal" )
						.on("taphold dblclick",function(){
							var $this = $(this);
							if( $this.hasClass('session_color_style_favorite') ){
								$this.removeClass('session_color_style_favorite');
								Cookies.remove( m_year + '_' + $this.attr('id') );
							}else{
								$this.addClass('session_color_style_favorite');
								Cookies.set( m_year + '_' + $this.attr('id'), '1', {expires:365} );
							}
						})
						.append( $infoMain );

					var link = $td.find('.ss_title a').attr('href');
					if( link !== undefined ){
						var id   = link.slice( link.lastIndexOf('/'), link.lastIndexOf('.html') ).replace('/','');
						$td.attr('id',id);
					}

					if( Cookies.get( m_year + '_' + $td.attr('id') ) !== undefined ){
						$td.addClass('session_color_style_favorite');
					}

					$td.find('.ss_spec').each(function(){
						var $this = $(this);
						var $style = $this.find('.ss_style');
						var text = $style.text();
						if( text.indexOf("基調講演") >= 0 ||
							text.indexOf("レギュラーセッション") >= 0 ||
							text.indexOf("ショートセッション") >= 0
						){
							$style.remove();
						}else{
							$style.before('<br/>')
						}
					});

					var $deteleTr = $tr;
					for( var d = 0 ; d < rowSpan-1 ; ++d ){
						$deteleTr = $deteleTr.next();
						$deteleTr.find('[room="'+room_name +'"]').hide();
					}
				}
			}

			return;

			//------------------------------------------------------------------
			//
			//------------------------------------------------------------------
			function getRowSpan( startTimeStr, endTimeStr ){
				var s = startTimeStr.split(':');
				s = parseInt(s[0]) * 60 + parseInt(s[1]);

				var e = endTimeStr.split(':');
				e = parseInt(e[0]) * 60 + parseInt(e[1]);
				return (e - s) / MIN_MINUTES;
			}
		}

		//----------------------------------------------------------------------
		//  不要なTrをhideしておく
		//----------------------------------------------------------------------
		function hideTr( $table, roomList ){

			var min_time = 12*60;
			var max_time = 12*60;

			for(var room_name in roomList){
				var rList = roomList[room_name];

				for( var s = 0 ; s < rList.length ; ++s ){
					var time_s = rList[s].getStartTime();
					var time_e = rList[s].getEndTime();
					if( min_time > time_s ){ min_time = time_s; }
					if( max_time < time_e ){ max_time = time_e; }
				}
			}

			$table.find("tr").each(function(){
				var $this = $(this);

				var s = $this.attr("time");
				if( s===undefined )	return;
				s = s.split(':');
				if( s === undefined )	return;
				var time = parseInt(s[0]) * 60 + parseInt(s[1]);
				if( time < min_time )	$this.hide();
				if( time > max_time )	$this.hide();
			});
		}

		//----------------------------------------------------------------------
		// 埋め込まれている相対パスからの間違ったパスを変換する
		//----------------------------------------------------------------------
		function convertGlobalPath( $table ){

			// イメージタグのパスをグローバルに編子
			$table.find("img").each(function(){
				var $this = $(this);
				var path = $this.attr("src").replace("../",m_rootURL );
				$this.attr("src", path );
			});

			// 相対パスのURLを変更。 さらにスライドが面倒なので #content に飛ばしてみる
			$table.find("a").each(function(){
				var $this = $(this);
				var path = $this.attr("href").replace("../",m_rootURL )  + "#content";
				$this.attr("href", path );
			});
		}

		//----------------------------------------------------------------------
		//
		//----------------------------------------------------------------------
		function customizeTable(day_index){
			if( highlightInfo.enabled && highlightInfo.dayIndex == day_index ){
				highlightedNowTime( m_debugHighlighDay );

				highlightInfo.intervalId = setInterval(function(){
					highlightedNowTime();
				}, 1000 * 60 );
			}
		}
	}

	//--------------------------------------------------------------------------
	//
	//--------------------------------------------------------------------------
	function highlightedNowTime( date ){

		if( date === undefined ){
			date = new Date();
		}

		var hours = date.getHours();
		if( hours.toString().length == 1 ) hours = "0" + hours;
		var minutes = date.getMinutes();

		var $table = $('#day_table');
		var $trList = $table.find('tbody tr[time*="' + hours +':"]');

		var currentIndex = 0;
		for(; currentIndex < $trList.length ; ++currentIndex ){
			var $tr	= $( $trList[currentIndex] );
			var temp = $tr.attr("time").split(":");
			var tr_hour    = parseInt( temp[0], 10 );
			var tr_minutes = parseInt( temp[1], 10 );
			var tr_date    = new Date(date.getFullYear(),date.getMonth(),date.getDate(),tr_hour,tr_minutes);

			if( tr_date.getTime() > date.getTime() ){
				currentIndex -= 1;
				if( currentIndex < 0 ) currentIndex = 0;
				break;
			}else if( tr_date.getTime() == date.getTime() ){
				break;
			}
		}

		if( currentIndex == $trList.length ){
			currentIndex -= 1;
		}

		// ハイライトクラスを設定
		var highlightSecelctor = ':eq(0),:empty';

		$table.find('tbody td.current_time').removeClass('current_time');
		$( $trList[currentIndex] ).children(highlightSecelctor).addClass('current_time');
	}

	//--------------------------------------------------------------------------
	//
	//--------------------------------------------------------------------------
	function appendLinkToCEDiL( list ){
//		var debugList = [];
//		for( var i = 0 ; i < list.length ; ++i ){
//			debugList.push( list[i].title );
//		}
//		alert( debugList.length + "\n" + debugList.join("\r\n") );

		$('#day_table').find('td.session').each(function(){
			var $this = $(this);
			if( $this.text().indexOf("CEDiL page") != -1 ) return;	// 多重登録防止
			var title = $this.find('.ss_title').text();
			for( var i = 0 ; i < list.length ; ++i ){
				if( title.indexOf( list[i].title ) == -1 ) continue;
				$this.append( '<p><a href="' + list[i].url +'#breadcrumbs" target="blank">CEDiL page</a></p>')
				break;
			}
		});


	}

	//==========================================================================
	//
	//==========================================================================
	function getURL_Params(){
		var params = {};
		var tmp = location.href.split('?');
		var pair = tmp.length < 2 ? [] : tmp[1].split('&');

		for( var i = 0 ; i < pair.length ; ++i ){
			var p = pair[i].split('=');
			if( p.length < 2 ) continue;
			params[ p[0] ] = p[1];
		}
		return params;
	}

	//--------------------------------------------------------------------------
	// test code
	// failed: クロスドメインアクセスの画像ではエラーの為未使用。
	//         元のカラーに戻す処理を書いてないので使用する際は要追加。
	//--------------------------------------------------------------------------
	function grayscale(img){
	    var canvas = document.createElement('canvas');
	    var ctx = canvas.getContext('2d');

	    var imgObj = new Image();
	    imgObj.src = img;

	    canvas.width = imgObj.width;
	    canvas.height = imgObj.height;

	    ctx.drawImage(imgObj, 0, 0);

	    var imgPixels = ctx.getImageData(0, 0, canvas.width, canvas.height);

	    for(var y = 0; y < imgPixels.height; y++){
	            for(var x = 0; x < imgPixels.width; x++){
	               var i = (y * 4) * imgPixels.width + x * 4;
	               var avg = (imgPixels.data[i] +
	                          imgPixels.data[i + 1] +
	                          imgPixels.data[i + 2]
	                          ) / 3;
	               imgPixels.data[i] = avg;
	               imgPixels.data[i + 1] = avg;
	               imgPixels.data[i + 2] = avg;
	            }
	    }

        ctx.putImageData(imgPixels, 0, 0, 0, 0, imgPixels.width, imgPixels.height);
        return canvas.toDataURL();
    }

})();
