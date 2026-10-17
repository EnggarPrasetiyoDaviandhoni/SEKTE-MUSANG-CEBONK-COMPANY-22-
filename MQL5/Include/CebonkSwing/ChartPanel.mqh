#ifndef CEBONK_SWING_PANEL_MQH
#define CEBONK_SWING_PANEL_MQH
class CSPanel {
 private:
  string m_prefix;
  void Label(string name,string text,int y,color c){
   string key=m_prefix+name;if(ObjectFind(0,key)<0)ObjectCreate(0,key,OBJ_LABEL,0,0,0);
   ObjectSetInteger(0,key,OBJPROP_CORNER,CORNER_LEFT_UPPER);ObjectSetInteger(0,key,OBJPROP_XDISTANCE,18);ObjectSetInteger(0,key,OBJPROP_YDISTANCE,y);
   ObjectSetInteger(0,key,OBJPROP_COLOR,c);ObjectSetInteger(0,key,OBJPROP_FONTSIZE,9);ObjectSetString(0,key,OBJPROP_FONT,"Consolas");ObjectSetString(0,key,OBJPROP_TEXT,text);
  }
  void Button(string name,string text,int y,int width,color bg){
   string key=m_prefix+name;if(ObjectFind(0,key)<0)ObjectCreate(0,key,OBJ_BUTTON,0,0,0);
   ObjectSetInteger(0,key,OBJPROP_XDISTANCE,12);ObjectSetInteger(0,key,OBJPROP_YDISTANCE,y);ObjectSetInteger(0,key,OBJPROP_XSIZE,width);ObjectSetInteger(0,key,OBJPROP_YSIZE,40);
   ObjectSetInteger(0,key,OBJPROP_BGCOLOR,bg);ObjectSetInteger(0,key,OBJPROP_COLOR,clrWhite);ObjectSetInteger(0,key,OBJPROP_FONTSIZE,12);ObjectSetInteger(0,key,OBJPROP_STATE,false);ObjectSetString(0,key,OBJPROP_TEXT,text);
  }
 public:
  void Init(){m_prefix="CEBONK_SWING_"+IntegerToString(ChartID())+"_";}
  bool Toggle(string object){return object==m_prefix+"autopilot";}
  bool Test(string object){return object==m_prefix+"notify";}
  void Draw(bool on,bool exitProtection,string &rows[]){
   string bg=m_prefix+"background";if(ObjectFind(0,bg)<0)ObjectCreate(0,bg,OBJ_RECTANGLE_LABEL,0,0,0);
   ObjectSetInteger(0,bg,OBJPROP_XDISTANCE,6);ObjectSetInteger(0,bg,OBJPROP_YDISTANCE,6);ObjectSetInteger(0,bg,OBJPROP_XSIZE,790);ObjectSetInteger(0,bg,OBJPROP_YSIZE,155+ArraySize(rows)*18);
   ObjectSetInteger(0,bg,OBJPROP_BGCOLOR,clrBlack);ObjectSetInteger(0,bg,OBJPROP_BORDER_TYPE,BORDER_FLAT);
   Button("autopilot",on?"AUTOPILOT ON":"AUTOPILOT OFF",15,560,on?clrDarkGreen:clrMaroon);
   for(int i=0;i<ArraySize(rows);i++)Label("row"+IntegerToString(i),rows[i],68+i*18,clrWhite);
   Label("exit",on?"ENTRIES ON":exitProtection?"OFF ENTRIES / EXIT PROTECTION ON":"OFF ENTRIES / SERVER SL-TP ACTIVE",72+ArraySize(rows)*18,clrYellow);
   Button("notify","TEST NOTIFIKASI",100+ArraySize(rows)*18,260,clrDarkSlateGray);ChartRedraw();
  }
  void Remove(){if(m_prefix!="")ObjectsDeleteAll(0,m_prefix);}
};
#endif
