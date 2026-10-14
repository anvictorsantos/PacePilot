<script>
import { h } from "vue";

// Verbatim move of the inline WeekSchedule h() component from
// TodayWorkoutView (Pass 6: extract, no visual change).
export default {
  props: { week: Array },
  setup(props) {
    return () =>
      h("div", { class: "flex flex-col gap-2" }, [
        h(
          "p",
          {
            class: "font-bold text-muted text-label uppercase tracking-widest",
          },
          `This Week's Schedule`,
        ),
        h(
          "div",
          { class: "flex flex-col gap-1.5" },
          props.week.map((entry) => {
            const isToday = !!entry.isToday;
            const isRest = entry.workout?.type === "rest";
            const isSkipped = entry.workout?.status === "skipped";
            const cls = isToday
              ? "bg-primary/[0.13] border-primary"
              : "bg-card border-white/10";
            const dayCls = isToday
              ? "text-primary font-extrabold"
              : isRest || isSkipped
                ? "text-white/30"
                : "text-muted font-bold";
            const nameCls = isRest || isSkipped
              ? "text-white/40"
              : isToday
                ? "text-white font-bold"
                : "text-white font-medium";
            const distCls = isToday
              ? "text-primary"
              : isRest || isSkipped
                ? "text-white/30"
                : "text-muted";
            const dist = entry.workout?.distance || (isRest || isSkipped ? "—" : "");
            const label = isSkipped ? "Skipped" : entry.workout?.label || entry.workout?.type || "—";
            return h(
              "div",
              {
                class: `flex items-center justify-between p-2.5 rounded-card border text-xs ${cls}`,
                key: entry.date,
              },
              [
                h("div", { class: "flex items-center gap-3" }, [
                  h(
                    "p",
                    { class: `w-8 font-bold text-label ${dayCls}` },
                    entry.day,
                  ),
                  h(
                    "p",
                    { class: `text-xs whitespace-nowrap ${nameCls}` },
                    isRest ? "Rest Day" : label,
                  ),
                ]),
                h(
                  "p",
                  {
                    class: `font-semibold text-xs whitespace-nowrap ${distCls}`,
                  },
                  dist || "—",
                ),
              ],
            );
          }),
        ),
      ]);
  },
};
</script>
