import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel } from "@/lib/permissions";

export default async function OpsScreen() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const level = bestAccessForModule(user.permissions, "תפעול");
  if (!meetsRequirement(level, AccessLevel.VIEW_ONLY)) {
    return (
      <main className="p-6">
        <p className="text-red-600">אין לך הרשאה לצפות בעמוד זה.</p>
      </main>
    );
  }

  return (
    <div id="ops-screen" className="sub-screen">
      <div className="sub-screen-header">
        <Link href="/" className="sub-back-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          חזרה
        </Link>
        <div className="sub-breadcrumb">
          <span>בחירת תחום</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          <span style={{color:"#1A2B1F",fontWeight:600}}>תפעול</span>
        </div>
      </div>
      <div className="sub-title-area">
        <div className="sub-title">תפעול</div>
        <div className="sub-title-thai">การปฏิบัติงาน</div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:"14px",padding:"16px 20px",maxWidth:"680px",margin:"0 auto",width:"100%",boxSizing:"border-box"}}>

        <Link href="/ops/management" style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,#3D9A6A,#2C7A52)",border:"none",borderRadius:"14px",padding:"18px 22px",cursor:"pointer",fontFamily:"inherit",textDecoration:"none",boxShadow:"0 5px 0 #1A5435,0 6px 16px rgba(28,84,53,0.3)",transition:"all .15s"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"2px"}}>
            <span style={{fontSize:"17px",fontWeight:800,color:"white"}}>ניהול תפעול</span>
            <span style={{fontSize:"12px",color:"rgba(255,255,255,0.7)"}}>การจัดการปฏิบัติงาน</span>
          </div>
          <span style={{fontSize:"28px"}}>🗂️</span>
        </Link>

        <Link href="/weighings" style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,#3A8FD4,#2271B2)",border:"none",borderRadius:"14px",padding:"18px 22px",cursor:"pointer",fontFamily:"inherit",textDecoration:"none",boxShadow:"0 5px 0 #144D80,0 6px 16px rgba(20,77,128,0.3)",transition:"all .15s"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"2px"}}>
            <span style={{fontSize:"17px",fontWeight:800,color:"white"}}>שקילות</span>
            <span style={{fontSize:"12px",color:"rgba(255,255,255,0.7)"}}>การชั่งน้ำหนัก</span>
          </div>
          <span style={{fontSize:"28px"}}>⚖️</span>
        </Link>

        <Link href="/transfers/new" style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,#2BAEA6,#1D8C85)",border:"none",borderRadius:"14px",padding:"18px 22px",cursor:"pointer",fontFamily:"inherit",textDecoration:"none",boxShadow:"0 5px 0 #0D5E59,0 6px 16px rgba(13,94,89,0.3)",transition:"all .15s"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"2px"}}>
            <span style={{fontSize:"17px",fontWeight:800,color:"white"}}>העברות</span>
            <span style={{fontSize:"12px",color:"rgba(255,255,255,0.7)"}}>การโอนปลา</span>
          </div>
          <span style={{fontSize:"28px"}}>🔄</span>
        </Link>

        <Link href="/ops/deliveries/new" style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,#7C3AED,#5B21B6)",border:"none",borderRadius:"14px",padding:"18px 22px",cursor:"pointer",fontFamily:"inherit",textDecoration:"none",boxShadow:"0 5px 0 #3B1A8A,0 6px 16px rgba(59,26,138,0.3)",transition:"all .15s"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"2px"}}>
            <span style={{fontSize:"17px",fontWeight:800,color:"white"}}>הפקת תעודת משלוח</span>
            <span style={{fontSize:"12px",color:"rgba(255,255,255,0.7)"}}>ออกใบส่งสินค้า</span>
          </div>
          <span style={{fontSize:"28px"}}>📄</span>
        </Link>

        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,#E8544A,#C93B31)",border:"none",borderRadius:"14px",padding:"18px 22px",cursor:"not-allowed",fontFamily:"inherit",boxShadow:"0 5px 0 #8B2820,0 6px 16px rgba(139,40,32,0.3)",transition:"all .15s",opacity:0.65}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"2px"}}>
            <span style={{fontSize:"17px",fontWeight:800,color:"white"}}>ביצוע טיפולים</span>
            <span style={{fontSize:"12px",color:"rgba(255,255,255,0.7)"}}>การรักษา</span>
          </div>
          <span style={{fontSize:"28px"}}>💊</span>
        </div>

      </div>
    </div>
  );
}
