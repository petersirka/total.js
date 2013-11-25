// Copyright 2012-2014 (c) Peter Širka <petersirka@gmail.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

"use strict";var child=require("child_process");var exec=child.exec;var spawn=child.spawn;var sof={192:true,193:true,194:true,195:true,197:true,198:true,199:true,201:true,202:true,203:true,205:true,206:true,207:true};function u16(buf,o){return buf[o]<<8|buf[o+1]}function u32(buf,o){return buf[o]<<24|buf[o+1]<<16|buf[o+2]<<8|buf[o+3]}exports.measureGIF=function(buffer){return{width:buffer[6],height:buffer[8]}};exports.measureJPG=function(buffer){var len=buffer.length;var o=0;var jpeg=255==buffer[0]&&216==buffer[1];if(!jpeg)return;o+=2;while(o<len){while(255!=buffer[o])o++;while(255==buffer[o])o++;if(!sof[buffer[o]]){o+=u16(buffer,++o);continue}var w=u16(buffer,o+6);var h=u16(buffer,o+4);return{width:w,height:h}}return null};exports.measurePNG=function(buffer){return{width:u32(buffer,16),height:u32(buffer,16+4)}};function Image(filename,imageMagick){var type=typeof filename;this.builder=[];this.filename=type==="string"?filename:null;this.stream=type==="object"?filename:null;this.isIM=imageMagick||false;if(!filename)throw new Error("Image filename is undefined.")}Image.prototype.clear=function(){var self=this;self.builder=[];return self};Image.prototype.measure=function(callback){var self=this;var index=self.filename.lastIndexOf(".");if(!self.filename){callback(new Error("Measure does not support stream."));return}if(index===-1){callback(new Error("This type of file is not supported."));return}var extension=self.filename.substring(index).toLowerCase();var stream=require("fs").createReadStream(self.filename,{start:0,end:extension===".jpg"?1e3:24});stream.on("data",function(buffer){switch(extension){case".jpg":callback(null,exports.measureJPG(buffer));return;case".gif":callback(null,exports.measureGIF(buffer));return;case".png":callback(null,exports.measurePNG(buffer));return}callback(new Error("This type of file is not supported."))});stream.on("error",callback);return self};Image.prototype.save=function(filename,callback){var self=this;if(typeof filename==="function"){callback=filename;filename=null}filename=filename||self.filename||"";var command=self.cmd(self.filename===null?"-":self.filename,filename);if(self.builder.length===0){if(callback)callback(null,filename);return}var cmd=exec(command,function(error,stdout,stderr){self.clear();if(callback){if(error)callback(error,"");else callback(null,filename)}});if(self.stream)self.stream.pipe(cmd.stdin);return self};Image.prototype.pipe=function(stream){var self=this;if(self.builder.length===0)return;var cmd=spawn(self.isIM?"convert":"gm",self.arg(self.filename===null?"-":self.filename,"-"));cmd.stderr.on("data",stream.emit.bind(stream,"error"));cmd.stdout.on("data",stream.emit.bind(stream,"data"));cmd.stdout.on("end",stream.emit.bind(stream,"end"));cmd.on("error",stream.emit.bind(stream,"error"));cmd.stdout.pipe(stream);if(self.stream)self.stream.pipe(cmd.stdin);return self};Image.prototype.cmd=function(filenameFrom,filenameTo){var self=this;var cmd="";self.builder.sort(function(a,b){if(a.priority>b.priority)return 1;else return-1});self.builder.forEach(function(o){cmd+=(cmd.length>0?" ":"")+o.cmd});return(self.isIM?"convert":"gm -convert")+' "'+filenameFrom+'"'+" "+cmd+' "'+filenameTo+'"'};Image.prototype.arg=function(first,last){var self=this;var arr=[];if(!self.isIM)arr.push("-convert");if(first)arr.push(first);self.builder.sort(function(a,b){if(a.priority>b.priority)return 1;else return-1});self.builder.forEach(function(o){var index=o.cmd.indexOf(" ");if(index===-1)arr.push(o.cmd);else{arr.push(o.cmd.substring(0,index));arr.push(o.cmd.substring(index+1).replace(/\"/g,""))}});if(last)arr.push(last);return arr};Image.prototype.identify=function(cb){var self=this;exec((self.isIM?"identify":"gm identify")+' "'+self.fileName+'"',function(error,stdout,stderr){if(error){cb(error,null);return}var arr=stdout.split(" ");var size=arr[2].split("x");var obj={type:arr[1],width:utils.parseInt(size[0]),height:utils.parseInt(size[1])};cb(null,obj)});return self};Image.prototype.push=function(key,value,priority){var self=this;self.builder.push({cmd:key+(value?' "'+value+'"':""),priority:priority});return self};Image.prototype.resize=function(w,h,options){options=options||"";var self=this;var size="";if(w&&h)size=w+"x"+h;else if(w&&!h)size=w;else if(!w&&h)size="x"+h;return self.push("-resize",size+options,1)};Image.prototype.clean=function(){return this.push("+profile","*")};Image.prototype.resizeCenter=function(w,h){return this.resize(w,h,"^").align("center").crop(w,h)};Image.prototype.scale=function(w,h,options){options=options||"";var self=this;var size="";if(w&&h)size=w+"x"+h;else if(w&&!h)size=w;else if(!w&&h)size="x"+h;return self.push("-scale",size+options,1)};Image.prototype.crop=function(w,h,x,y){return this.push("-crop",w+"x"+h+"+"+(x||0)+"+"+(y||0),4)};Image.prototype.quality=function(percentage){return this.push("-quality",percentage||80,5)};Image.prototype.align=function(type){var output="";switch(type.toLowerCase().replace("-","")){case"left top":case"top left":output="NorthWest";break;case"left bottom":case"bottom left":output="SouthWest";break;case"right top":case"top right":output="NorthEast";break;case"right bottom":case"bottom right":output="SouthEast";break;case"left center":case"center left":case"left":output="West";break;case"right center":case"center right":case"right":output="East";break;case"bottom center":case"center bottom":case"bottom":output="South";break;case"top center":case"center top":case"top":output="North";break;case"center center":case"center":output="Center";break;default:output=type;break}return this.push("-gravity",output,3)};Image.prototype.gravity=function(type){return this.align(type)};Image.prototype.blur=function(radius){return this.push("-blur",radius,10)};Image.prototype.normalize=function(){return this.push("-normalize",null,10)};Image.prototype.rotate=function(deg){return this.push("-rotate",deg||0,8)};Image.prototype.flip=function(){return this.push("-flip",null,10)};Image.prototype.flop=function(){return this.push("-flop",null,10)};Image.prototype.minify=function(){return this.push("-minify",null,10)};Image.prototype.grayscale=function(){return this.push("-modulate 100,0",null,10)};Image.prototype.background=function(color){return this.push("-background",color,2)};Image.prototype.sepia=function(){return this.push("-modulate 115,0,100 \\ -colorize 7,21,50",null,10)};Image.prototype.command=function(key,value,priority){return this.push(cmd,null,priority||10)};exports.Image=Image;exports.Picture=Image;exports.init=function(filename,imageMagick){return new Image(filename,imageMagick)};exports.load=function(filename,imageMagick){return new Image(filename,imageMagick)};