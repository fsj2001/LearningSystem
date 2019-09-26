﻿var menvue = new Vue({
    //el: '#menu',
    data: {
        message: '测试',
        arr: [1, 2]         //接口列表
    },
    methods: {
        homeClick: function () {
            rvue.method = null;
        }
    },
    created: function () {
        var th = this;
        $api.get("helper/List").then(function (req) {
            if (req.data.success) {
                th.arr = req.data.result;
            }
        });
    }
});
menvue.$mount('#menu');

// 注册组件
Vue.component('methods', {
    // 声明 props，用于向组件传参
    props: ['name', 'intro', 'index'],
    data: function () {
        return {
            methods: [],     //方法列表
            loading: true,       //预载中
            open: false      //是否打开方法列表
        }
    },
    methods: {
        //方法的点击事件
        methodClick: function (method) {
            rvue.method = method;
        }
    },
    created: function () {
        var name = this.name;
        var th = this;
        $api.get("helper/Methods", { classname: name }).then(function (req) {
            if (req.data.success) {
                th.methods = req.data.result;
                th.loading = false;
            }
        });
    },
    // 
    template: "<div>\
      <div class='classname' v-on:click='open=!open' :title='\"摘要：\"+intro'>\
            {{index}}. <b class='el-icon-loading' v-show='loading'></b>{{ name }} \
            <span>{{intro}}</span>\
            <i class='el-icon-arrow-right' v-show='!open'></i><i class='el-icon-arrow-down' v-show='open'></i>\
       </div>\
       <dl class='methods' v-show='open'>\
       <dt v-if='intro.length>0'>摘要：{{intro}}</dt>\
            <dd v-for='(item,i) in methods' v-on:click='methodClick(item)'>\
                {{index}}.{{i+1}}.{{item.Name}} \
                <div v-show='item.Intro.length>0'>--{{item.Intro}}</div>\
            </dd>\
       </dl>\
       </div>"
})
/*

*/
//右侧的内容区
var rvue = new Vue({
    data: {
        method: null,    //接口方法对象
        loading: false   //调用接口时的状态
    },
    watch: {
        method: function (n, o) {
            var ele = document.getElementById("testResult");
            if (ele != null) ele.firstChild.innerText = "";
            document.querySelectorAll("#context table input").forEach(function (item) {
                item.value = "";
            });
        }
    },
    computed: {
        showname: function () {
            var fullname = this.method.FullName;
            var name = this.method.Name;
            if (fullname.indexOf('(') > -1) {
                return name + fullname.substring(fullname.indexOf('('));
            }
            return name + '()';
        }
    },
    methods: {
        testapi: function () {
            var mathd = this.method.ClassName + "/" + this.method.Name;
            var params = this.getInputPara();
            var http = document.getElementById("httppre").value;
            var rettype = document.getElementById("returntype").value;
            //
            $api.query(mathd, params, http, function () {
                rvue.loading = true;
            }, function () {
                window.setTimeout(function () {
                    rvue.loading = false;
                }, 500);
            }, rettype).then(function (req) {
                var ele = document.getElementById("testResult").firstChild;
                if (req == null) throw { message: '没有获取到返回值，可能是服务器端错误' };
                if (req.config.returntype == "json")
                    ele.innerText = rvue.jsonformat(unescape(req.text));
                if (req.config.returntype == "xml")
                    ele.innerText = rvue.xmlformat(unescape(req.text));
            }).catch(function (ex) {
                //alert(ex.message);
                var ele = document.getElementById("testResult").firstChild;
                ele.innerText = ex.message;
            });
        },
        //获取录入的参数
        getInputPara: function () {
            var arr = new Array();
            document.querySelectorAll("#context table input").forEach(function (item) {
                var name = item.getAttribute("name");
                var val = item.value;
                arr.push("'" + name + "':'" + val + "'");
            });
            var txt = "({";
            for (var i = 0; i < arr.length; i++) {
                txt += arr[i];
                if (i < arr.length - 1) txt += ",";
            }
            txt += "})";
            return eval(txt);
        },
        //json字符格式化
        jsonformat: function (json) {
            var formatted = '',     //转换后的json字符串
                padIdx = 0,         //换行后是否增减PADDING的标识
                PADDING = '    ';   //4个空格符
            /**
             * 将对象转化为string
             */
            if (typeof json !== 'string') {
                json = JSON.stringify(json);
            }
            /** 
             *利用正则类似将{'name':'ccy','age':18,'info':['address':'wuhan','interest':'playCards']}
             *---> \r\n{\r\n'name':'ccy',\r\n'age':18,\r\n
             *'info':\r\n[\r\n'address':'wuhan',\r\n'interest':'playCards'\r\n]\r\n}\r\n
             */
            json = json.replace(/([\{\}])/g, '\r\n$1\r\n')
                //.replace(/([\[\]])/g, '\r\n$1\r\n')
                .replace(/(\,)/g, '$1\r\n')
                .replace(/(\r\n\r\n)/g, '\r\n')
                .replace(/\r\n\,/g, ',');
            /** 
             * 根据split生成数据进行遍历，一行行判断是否增减PADDING
             */
            (json.split('\r\n')).forEach(function (node, index) {
                var indent = 0, padding = '';
                if (node.match(/\{$/) || node.match(/\[$/)) indent = 1;
                else if (node.match(/\}/) || node.match(/\]/)) padIdx = padIdx !== 0 ? --padIdx : padIdx;
                else indent = 0;
                for (var i = 0; i < padIdx; i++)    padding += PADDING;
                formatted += padding + node + '\r\n';
                padIdx += indent;
                //console.log('index:' + index + ',indent:' + indent + ',padIdx:' + padIdx + ',node-->' + node);
            });
            return formatted;
        },
        //xml格式化
        xmlformat: function (text) {
            //计算头函数 用来缩进
            function setPrefix(prefixIndex) {
                var result = '';
                var span = '    ';//缩进长度
                var output = [];
                for (var i = 0; i < prefixIndex; ++i) {
                    output.push(span);
                }
                result = output.join('');
                return result;
            }
            //使用replace去空格
            text = '\n' + text.replace(/(<\w+)(\s.*?>)/g, function ($0, name, props) {
                return name + ' ' + props.replace(/\s+(\w+=)/g, " $1");
            }).replace(/>\s*?</g, ">\n<");
            //处理注释
            text = text.replace(/\n/g, '\r').replace(/<!--(.+?)-->/g, function ($0, text) {
                var ret = '<!--' + escape(text) + '-->';
                return ret;
            }).replace(/\r/g, '\n');
            //调整格式  以压栈方式递归调整缩进
            var rgx = /\n(<(([^\?]).+?)(?:\s|\s*?>|\s*?(\/)>)(?:.*?(?:(?:(\/)>)|(?:<(\/)\2>)))?)/mg;
            var nodeStack = [];
            var output = text.replace(rgx, function ($0, all, name, isBegin, isCloseFull1, isCloseFull2, isFull1, isFull2) {
                var isClosed = (isCloseFull1 == '/') || (isCloseFull2 == '/') || (isFull1 == '/') || (isFull2 == '/');
                var prefix = '';
                if (isBegin == '!') {//!开头
                    prefix = setPrefix(nodeStack.length);
                } else {
                    if (isBegin != '/') {///开头
                        prefix = setPrefix(nodeStack.length);
                        if (!isClosed) {//非关闭标签
                            nodeStack.push(name);
                        }
                    } else {
                        nodeStack.pop();//弹栈
                        prefix = setPrefix(nodeStack.length);
                    }
                }
                var ret = '\n' + prefix + all;
                return ret;
            });
            var prefixSpace = -1;
            var outputText = output.substring(1);
            //还原注释内容
            outputText = outputText.replace(/\n/g, '\r').replace(/(\s*)<!--(.+?)-->/g, function ($0, prefix, text) {
                if (prefix.charAt(0) == '\r')
                    prefix = prefix.substring(1);
                text = unescape(text).replace(/\r/g, '\n');
                var ret = '\n' + prefix + '<!--' + text.replace(/^\s*/mg, prefix) + '-->';
                return ret;
            });
            outputText = outputText.replace(/\s+$/g, '').replace(/\r/g, '\r\n');
            return outputText;
        }
    },
    created: function () {

    }
});
rvue.$mount('context');

function formateXml(xmlStr) {
    text = xmlStr;

}

