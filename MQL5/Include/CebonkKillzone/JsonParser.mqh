#ifndef CEBONK_KILLZONE_JSON_MQH
#define CEBONK_KILLZONE_JSON_MQH
enum CKAJKind {CKAJ_NULL,CKAJ_OBJECT,CKAJ_ARRAY,CKAJ_STRING,CKAJ_NUMBER,CKAJ_BOOL};
struct CKAJToken {int kind,parent,first,last,next,count,start;string key,text;double number;};
class CKAJson {
 private:
  string m_raw,m_error;int m_pos;CKAJToken m_nodes[];
  void White(){while(m_pos<StringLen(m_raw)){ushort c=StringGetCharacter(m_raw,m_pos);if(c!=32&&c!=9&&c!=10&&c!=13)break;m_pos++;}}
  ushort Peek(){return m_pos<StringLen(m_raw)?StringGetCharacter(m_raw,m_pos):0;}
  bool Fail(string message){if(m_error=="")m_error=message;return false;}
  int Add(int kind,int parent,string key){
   int n=ArraySize(m_nodes);if(n>=48000){Fail("JSON_NODE_LIMIT");return -1;}
   ArrayResize(m_nodes,n+1,256);m_nodes[n].kind=kind;m_nodes[n].parent=parent;m_nodes[n].key=key;
   m_nodes[n].first=-1;m_nodes[n].last=-1;m_nodes[n].next=-1;m_nodes[n].count=0;m_nodes[n].start=m_pos;
   m_nodes[n].number=0;m_nodes[n].text="";
   if(parent>=0){int last=m_nodes[parent].last;if(last>=0)m_nodes[last].next=n;else m_nodes[parent].first=n;
    m_nodes[parent].last=n;m_nodes[parent].count++;}
   return n;
  }
  int Hex4(){
   if(m_pos+4>StringLen(m_raw)){Fail("JSON_UNICODE");return -1;}int value=0;
   for(int k=0;k<4;k++){int c=(int)StringGetCharacter(m_raw,m_pos++),v=c>=48&&c<=57?c-48:c>=65&&c<=70?c-55:c>=97&&c<=102?c-87:-1;
    if(v<0){Fail("JSON_UNICODE");return -1;}value=value*16+v;}return value;
  }
  bool StringValue(string &out){
   if(Peek()!=34)return Fail("JSON_STRING");m_pos++;out="";
   while(m_pos<StringLen(m_raw)){
    ushort c=StringGetCharacter(m_raw,m_pos++);if(c==34)return true;if(c<32)return Fail("JSON_CONTROL_CHAR");
    if(c!=92){out+=ShortToString(c);continue;}
    if(m_pos>=StringLen(m_raw))return Fail("JSON_ESCAPE");ushort e=StringGetCharacter(m_raw,m_pos++);
    if(e==34||e==92||e==47)out+=ShortToString(e);
    else if(e==98)out+=ShortToString(8);else if(e==102)out+=ShortToString(12);
    else if(e==110)out+="\n";else if(e==114)out+="\r";else if(e==116)out+="\t";
    else if(e==117){
     int h=Hex4();if(h<0)return false;
     if(h>=0xD800&&h<=0xDBFF){
      if(m_pos+2>StringLen(m_raw)||StringSubstr(m_raw,m_pos,2)!="\\u")return Fail("JSON_SURROGATE");
      m_pos+=2;int l=Hex4();if(l<0xDC00||l>0xDFFF)return Fail("JSON_SURROGATE");
      out+=ShortToString((ushort)h)+ShortToString((ushort)l);
     }else if(h>=0xDC00&&h<=0xDFFF)return Fail("JSON_SURROGATE");else out+=ShortToString((ushort)h);
    }else return Fail("JSON_ESCAPE");
   }
   return Fail("JSON_UNTERMINATED_STRING");
  }
  bool NumberValue(double &out){
   int start=m_pos;if(Peek()==45)m_pos++;
   if(Peek()==48)m_pos++;
   else{if(Peek()<49||Peek()>57)return Fail("JSON_NUMBER");while(Peek()>=48&&Peek()<=57)m_pos++;}
   if(Peek()==46){m_pos++;if(Peek()<48||Peek()>57)return Fail("JSON_FRACTION");while(Peek()>=48&&Peek()<=57)m_pos++;}
   if(Peek()==69||Peek()==101){m_pos++;if(Peek()==43||Peek()==45)m_pos++;
    if(Peek()<48||Peek()>57)return Fail("JSON_EXPONENT");while(Peek()>=48&&Peek()<=57)m_pos++;}
   out=StringToDouble(StringSubstr(m_raw,start,m_pos-start));return MathIsValidNumber(out)||Fail("JSON_NONFINITE");
  }
  int Value(int parent,string key,int depth){
   White();if(depth>24){Fail("JSON_DEPTH");return -1;}
   ushort c=Peek();int kind=c==123?CKAJ_OBJECT:c==91?CKAJ_ARRAY:c==34?CKAJ_STRING:c==110?CKAJ_NULL:(c==116||c==102)?CKAJ_BOOL:CKAJ_NUMBER;
   int id=Add(kind,parent,key);if(id<0)return -1;
   if(kind==CKAJ_OBJECT||kind==CKAJ_ARRAY){
    m_pos++;White();ushort end=kind==CKAJ_OBJECT?125:93;
    if(Peek()==end){m_pos++;return id;}
    while(true){
     string childKey="";
     if(kind==CKAJ_OBJECT){if(!StringValue(childKey))return -1;
      if(Get(id,childKey)>=0){Fail("JSON_DUPLICATE_KEY");return -1;}White();if(Peek()!=58){Fail("JSON_COLON");return -1;}m_pos++;}
     if(Value(id,childKey,depth+1)<0)return -1;White();
     if(Peek()==end){m_pos++;return id;}
     if(Peek()!=44){Fail("JSON_COMMA");return -1;}m_pos++;White();
    }
   }
   if(kind==CKAJ_STRING){string v;if(!StringValue(v))return -1;m_nodes[id].text=v;}
   else if(kind==CKAJ_NUMBER){double v;if(!NumberValue(v))return -1;m_nodes[id].number=v;}
   else if(kind==CKAJ_NULL){if(StringSubstr(m_raw,m_pos,4)!="null"){Fail("JSON_LITERAL");return -1;}m_pos+=4;}
   else{
    if(StringSubstr(m_raw,m_pos,4)=="true"){m_nodes[id].number=1;m_pos+=4;}
    else if(StringSubstr(m_raw,m_pos,5)=="false"){m_nodes[id].number=0;m_pos+=5;}
    else{Fail("JSON_LITERAL");return -1;}
   }
   return id;
  }
 public:
  bool Parse(string raw){m_raw=raw;m_pos=0;m_error="";ArrayResize(m_nodes,0);
   if(StringLen(raw)>2097152)return Fail("JSON_SIZE");if(Value(-1,"",0)!=0)return false;
   White();return m_pos==StringLen(m_raw)||Fail("JSON_TRAILING_DATA");}
  string Error(){return m_error;}
  int Kind(int i){return i>=0&&i<ArraySize(m_nodes)?m_nodes[i].kind:-1;}
  int Count(int i){return i>=0&&i<ArraySize(m_nodes)?m_nodes[i].count:0;}
  int Get(int object,string key){if(Kind(object)!=CKAJ_OBJECT)return -1;
   for(int c=m_nodes[object].first;c>=0;c=m_nodes[c].next)if(m_nodes[c].key==key)return c;return -1;}
  int At(int array,int index){if(Kind(array)!=CKAJ_ARRAY||index<0)return -1;int c=m_nodes[array].first;
   for(int i=0;i<index&&c>=0;i++)c=m_nodes[c].next;return c;}
  string Text(int i){return Kind(i)==CKAJ_STRING?m_nodes[i].text:"";}
  double Number(int i){return i>=0&&i<ArraySize(m_nodes)?m_nodes[i].number:0;}
  bool Integer(int i){return Kind(i)==CKAJ_NUMBER&&MathIsValidNumber(Number(i))&&MathFloor(Number(i))==Number(i);}
  bool Only(int object,string allowed){
   if(Kind(object)!=CKAJ_OBJECT)return false;string list[];int n=StringSplit(allowed,',',list);
   if(Count(object)!=n)return false;
   for(int k=0;k<n;k++)if(Get(object,list[k])<0)return false;return true;
  }
  bool VerifyHash(string raw){
   StringTrimRight(raw);string prefix=",\"payload_sha256\":\"";
   int marker=StringLen(raw)-StringLen(prefix)-64-2,id=Get(0,"payload_sha256");
   if(marker<1||Kind(id)!=CKAJ_STRING||m_nodes[id].start!=marker+StringLen(prefix)-1||
    StringSubstr(raw,marker,StringLen(prefix))!=prefix||StringSubstr(raw,StringLen(raw)-2)!="\"}")return false;
   string expected=StringSubstr(raw,marker+StringLen(prefix),64);
   for(int i=0;i<64;i++){ushort c=StringGetCharacter(expected,i);if(!((c>=48&&c<=57)||(c>=97&&c<=102)))return false;}
   string payload=StringSubstr(raw,0,marker)+"}";uchar bytes[],key[],digest[];
   int count=StringToCharArray(payload,bytes,0,WHOLE_ARRAY,CP_UTF8);if(count<=1)return false;ArrayResize(bytes,count-1);
   if(CryptEncode(CRYPT_HASH_SHA256,bytes,key,digest)!=32)return false;
   string actual="";for(int i=0;i<32;i++)actual+=StringFormat("%02x",(int)digest[i]);
   return actual==expected;
  }
};
string CKAJsonEscape(string value){
 string out="";for(int i=0;i<StringLen(value);i++){ushort c=StringGetCharacter(value,i);
  if(c==34||c==92)out+="\\"+ShortToString(c);else if(c<32)out+=StringFormat("\\u%04x",(int)c);else out+=ShortToString(c);}
 return out;
}
#endif
