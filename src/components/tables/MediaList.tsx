import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";
import Image from "next/image";

interface Media {
  id: number;
  name: string;
  type: "image" | "video";
  thumbnail: string;
  campaign: string;
  status: "active" | "paused" | "archived";
  impressions: number;
  clicks: number;
  createdAt: string;
  dimensions: {
    width: number;
    height: number;
  };
  fileSize: string;
}

const mediaData: Media[] = [
  {
    id: 1,
    name: "Summer Banner",
    type: "image",
    thumbnail: "/images/media/summer-banner.jpg",
    campaign: "Summer Sale",
    status: "active",
    impressions: 12500,
    clicks: 342,
    createdAt: "2023-06-15",
    dimensions: {
      width: 1200,
      height: 628
    },
    fileSize: "2.4 MB"
  },
  {
    id: 2,
    name: "Product Video",
    type: "video",
    thumbnail: "/images/media/product-video-thumb.jpg",
    campaign: "New Launch",
    status: "active",
    impressions: 8700,
    clicks: 521,
    createdAt: "2023-06-10",
    dimensions: {
      width: 1920,
      height: 1080
    },
    fileSize: "15.7 MB"
  },
  {
    id: 3,
    name: "Social Media Post",
    type: "image",
    thumbnail: "/images/media/social-post.jpg",
    campaign: "Brand Awareness",
    status: "paused",
    impressions: 5600,
    clicks: 189,
    createdAt: "2023-05-28",
    dimensions: {
      width: 1080,
      height: 1080
    },
    fileSize: "1.8 MB"
  },
  {
    id: 4,
    name: "Holiday Ad",
    type: "video",
    thumbnail: "/images/media/holiday-ad-thumb.jpg",
    campaign: "Winter Campaign",
    status: "archived",
    impressions: 24300,
    clicks: 876,
    createdAt: "2022-12-01",
    dimensions: {
      width: 1280,
      height: 720
    },
    fileSize: "8.2 MB"
  },
  {
    id: 5,
    name: "Email Header",
    type: "image",
    thumbnail: "/images/media/email-header.jpg",
    campaign: "Newsletter",
    status: "active",
    impressions: 3200,
    clicks: 210,
    createdAt: "2023-06-05",
    dimensions: {
      width: 600,
      height: 300
    },
    fileSize: "0.9 MB"
  },
];

export default function MediaTable() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto">
        <div className="min-w-[1102px]">
          <Table>
            {/* Table Header */}
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Media
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Type
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Campaign
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Dimensions
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Status
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Performance
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Created
                </TableCell>
              </TableRow>
            </TableHeader>

            {/* Table Body */}
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {mediaData.map((media) => (
                <TableRow key={media.id}>
                  <TableCell className="px-5 py-4 sm:px-6 text-start">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
                        <Image
                          width={64}
                          height={64}
                          src={media.thumbnail}
                          alt={media.name}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <div>
                        <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90">
                          {media.name}
                        </span>
                        <span className="block text-gray-500 text-theme-xs dark:text-gray-400">
                          {media.fileSize}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                    <Badge
                      size="sm"
                      color={media.type === "image" ? "info" : "primary"}
                    >
                      {media.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-800 text-start text-theme-sm dark:text-white/90">
                    {media.campaign}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                    {media.dimensions.width}×{media.dimensions.height}px
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                    <Badge
                      size="sm"
                      color={
                        media.status === "active"
                          ? "success"
                          : media.status === "paused"
                          ? "warning"
                          : "light"
                      }
                    >
                      {media.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-start">
                    <div className="flex flex-col gap-1">
                      <span className="text-gray-800 text-theme-sm dark:text-white/90">
                        {media.impressions.toLocaleString()} impressions
                      </span>
                      <span className="text-gray-500 text-theme-xs dark:text-gray-400">
                        {media.clicks.toLocaleString()} clicks
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                    {new Date(media.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}