import React from 'react';
import { View, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  data: number[]; // hours values
  labels: string[];
  maxValue?: number;
  contractedHours?: number; // reference line
  barColor?: string;
  overColor?: string;
}

export function BarChart({
  data,
  labels,
  maxValue,
  contractedHours,
  barColor,
  overColor,
}: Props) {
  const { colors, typography, spacing } = useTheme();

  const max = maxValue ?? Math.max(...data, contractedHours ?? 0, 1);
  const chartHeight = 120;

  const primaryColor = barColor ?? colors.primary;
  const overflowColor = overColor ?? colors.error;

  const accessibilityLabel = labels
    .map((label, i) => `${label}: ${data[i]?.toFixed(1) ?? 0} hours`)
    .join(', ');

  return (
    <View
      style={styles.container}
      accessibilityLabel={`Hours chart: ${accessibilityLabel}`}
      importantForAccessibility="yes"
    >
      {/* Y-axis labels and bars */}
      <View style={styles.chartArea}>
        {/* Contracted hours reference line */}
        {contractedHours != null && (
          <View
            style={[
              styles.referenceLine,
              {
                bottom: (contractedHours / max) * chartHeight,
                borderColor: colors.textDisabled,
              },
            ]}
          />
        )}

        {/* Bars */}
        <View style={styles.barsRow}>
          {data.map((value, i) => {
            const barH = Math.max((value / max) * chartHeight, 2);
            const isOver = contractedHours != null && value > contractedHours / (data.length || 1);
            const color = isOver ? overflowColor : primaryColor;

            return (
              <View key={i} style={styles.barWrapper}>
                <Text
                  style={[typography.caption, { color: colors.textSecondary, fontSize: 9, marginBottom: 2 }]}
                  numberOfLines={1}
                >
                  {value > 0 ? value.toFixed(0) : ''}
                </Text>
                <View
                  style={[styles.barBg, { height: chartHeight, backgroundColor: colors.surface3 }]}
                >
                  <View
                    style={[styles.bar, { height: barH, backgroundColor: color }]}
                  />
                </View>
                <Text
                  style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}
                  numberOfLines={1}
                >
                  {labels[i] ?? ''}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  chartArea: {
    position: 'relative',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 40,
  },
  barBg: {
    width: '70%',
    borderRadius: 3,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: 3,
  },
  referenceLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    zIndex: 1,
  },
});
