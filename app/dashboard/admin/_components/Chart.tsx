import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export function Chart({ title, data, dataKey }: any) {
  return (
    <div>
      <h2 className="font-semibold mb-2">{title}</h2>

      <LineChart width={600} height={300} data={data}>
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey={dataKey} />
      </LineChart>
    </div>
  );
}