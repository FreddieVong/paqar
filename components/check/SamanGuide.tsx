export function SamanGuide() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
        <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280] mb-4">
          Cara semak saman secara rasmi
        </p>

        <div className="space-y-5">
          {/* PDRM */}
          <div>
            <p className="font-heading font-bold text-[14px] text-[#111827] mb-2">
              Saman PDRM (polis)
            </p>
            <ol className="space-y-1.5 font-body text-[13px] text-[#374151] list-decimal list-inside leading-relaxed">
              <li>Buka <span className="font-bold">mybayar.rmp.gov.my</span></li>
              <li>Daftar atau log masuk dengan IC anda</li>
              <li>Pilih &quot;Semak Saman&quot;</li>
              <li>Masukkan nombor plat → lihat keputusan</li>
            </ol>
            <a
              href="https://mybayar.rmp.gov.my"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-block font-body text-[13px] text-[#1D4ED8] underline underline-offset-2"
            >
              Buka MyBayar PDRM →
            </a>
          </div>

          <div className="h-px bg-[#F3F4F6]" />

          {/* JPJ */}
          <div>
            <p className="font-heading font-bold text-[14px] text-[#111827] mb-2">
              Saman JPJ (jalan raya)
            </p>
            <ol className="space-y-1.5 font-body text-[13px] text-[#374151] list-decimal list-inside leading-relaxed">
              <li>Buka <span className="font-bold">myjpj.jpj.gov.my</span></li>
              <li>Log masuk dengan MyDigital ID atau IC</li>
              <li>Pilih &quot;Semakan Saman&quot;</li>
              <li>Masukkan nombor plat → lihat keputusan</li>
            </ol>
            <a
              href="https://myjpj.jpj.gov.my"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-block font-body text-[13px] text-[#1D4ED8] underline underline-offset-2"
            >
              Buka MyJPJ →
            </a>
          </div>

          <div className="h-px bg-[#F3F4F6]" />

          {/* What to do if saman found */}
          <div>
            <p className="font-heading font-bold text-[14px] text-[#111827] mb-2">
              Kalau ada saman?
            </p>
            <ul className="space-y-1.5 font-body text-[13px] text-[#374151] leading-relaxed">
              <li>• Minta penjual <span className="font-bold">selesaikan saman</span> sebelum tukar milik</li>
              <li>• Atau <span className="font-bold">tolak jumlah saman</span> dari harga jual</li>
              <li>• <span className="font-bold">Jangan bayar deposit</span> sebelum saman diselesaikan</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
